"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  MessageSquare,
  Send,
  Search,
  User,
  Users,
  Bell,
  ChevronRight,
  Clock,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { initialSupervisors } from "@/lib/initial-data"
import type { Message, UserRole } from "@/lib/types"

interface ThreadPreview {
  partnerId: string
  partnerName: string
  partnerRole: UserRole
  lastMessage: Message
  unreadCount: number
}

export function ChatInterface() {
  const { currentUser, draftMessage, setDraftMessage, navigateTo } = useRole()
  const {
    patients,
    navigators,
    directMessages,
    sendMessage,
    getThreadMessages,
    getUnreadCount,
    markThreadAsRead,
  } = useDemoData()

  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [draftApplied, setDraftApplied] = useState(false)

  // Get available contacts based on role
  const availableContacts = useMemo(() => {
    if (!currentUser) return []

    const contacts: { id: string; name: string; role: UserRole; subtitle?: string }[] = []

    if (currentUser.role === "supervisor") {
      // Supervisors can message their assigned navigators
      const supervisor = initialSupervisors.find((s) => s.name === currentUser.name)
      if (supervisor) {
        navigators
          .filter((nav) => supervisor.navigatorIds.includes(nav.id))
          .forEach((nav) => {
            contacts.push({
              id: nav.id,
              name: nav.name,
              role: "navigator",
              subtitle: `${nav.patientCount} patients`,
            })
          })
      }
    } else if (currentUser.role === "navigator") {
      // Navigators can message their supervisor, biller, and assigned patients
      const navigator = navigators.find((n) => n.name === currentUser.name || n.id === currentUser.id)
      if (navigator) {
        // Add supervisor
        const supervisor = initialSupervisors.find((s) => s.id === navigator.supervisorId)
        if (supervisor) {
          contacts.push({
            id: supervisor.id,
            name: supervisor.name,
            role: "supervisor",
            subtitle: "Supervisor",
          })
        }
        // Add biller for billing nudges
        contacts.push({
          id: "biller1",
          name: "Revenue Cycle Manager",
          role: "biller" as UserRole,
          subtitle: "Billing Department",
        })
        // Add assigned patients
        patients
          .filter((p) => p.assignedNavigator === navigator.id)
          .forEach((p) => {
            contacts.push({
              id: p.id,
              name: p.name,
              role: "patient",
              subtitle: p.healthPlan,
            })
          })
      }
    } else if (currentUser.role === "patient") {
      // Patients can only message their assigned navigator
      const patient = patients.find((p) => p.id === currentUser.id)
      if (patient) {
        const navigator = navigators.find((n) => n.id === patient.assignedNavigator)
        if (navigator) {
          contacts.push({
            id: navigator.id,
            name: navigator.name,
            role: "navigator",
            subtitle: "Care Navigator",
          })
        }
      }
    }

    return contacts
  }, [currentUser, navigators, patients])

  // Build thread list from messages and contacts
  const threads = useMemo((): ThreadPreview[] => {
    if (!currentUser) return []

    const threadMap = new Map<string, ThreadPreview>()

    // Add threads from existing messages
    directMessages.forEach((msg) => {
      const isIncoming = msg.receiverId === currentUser.id
      const partnerId = isIncoming ? msg.senderId : msg.receiverId
      const partnerName = isIncoming ? msg.senderName : msg.receiverName
      const partnerRole = isIncoming ? msg.senderRole : msg.receiverRole

      // Only include if this person is in our available contacts
      if (!availableContacts.some((c) => c.id === partnerId)) return

      const existing = threadMap.get(partnerId)
      if (!existing || new Date(msg.timestamp) > new Date(existing.lastMessage.timestamp)) {
        const unreadCount = directMessages.filter(
          (m) => m.senderId === partnerId && m.receiverId === currentUser.id && !m.readStatus
        ).length

        threadMap.set(partnerId, {
          partnerId,
          partnerName,
          partnerRole,
          lastMessage: msg,
          unreadCount,
        })
      }
    })

    // Add contacts without messages yet
    availableContacts.forEach((contact) => {
      if (!threadMap.has(contact.id)) {
        threadMap.set(contact.id, {
          partnerId: contact.id,
          partnerName: contact.name,
          partnerRole: contact.role,
          lastMessage: {
            id: "",
            senderId: "",
            senderName: "",
            senderRole: "patient",
            receiverId: "",
            receiverName: "",
            receiverRole: "patient",
            content: "No messages yet",
            timestamp: "",
            readStatus: true,
            type: "direct",
          },
          unreadCount: 0,
        })
      }
    })

    return Array.from(threadMap.values()).sort((a, b) => {
      // Sort by most recent message, then alphabetically
      if (a.lastMessage.timestamp && b.lastMessage.timestamp) {
        return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
      }
      if (a.lastMessage.timestamp) return -1
      if (b.lastMessage.timestamp) return 1
      return a.partnerName.localeCompare(b.partnerName)
    })
  }, [currentUser, directMessages, availableContacts])

  // Get current thread messages
  const currentThreadMessages = useMemo(() => {
    if (!currentUser || !selectedThread) return []
    return getThreadMessages(currentUser.id, selectedThread)
  }, [currentUser, selectedThread, getThreadMessages])

  // Get selected contact info
  const selectedContact = useMemo(() => {
    return availableContacts.find((c) => c.id === selectedThread)
  }, [availableContacts, selectedThread])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentThreadMessages])

  // Handle draft message from navigation (e.g., reschedule request)
  useEffect(() => {
    if (draftMessage && !draftApplied) {
      // Auto-select the recipient thread
      setSelectedThread(draftMessage.recipientId)
      // Pre-fill the message input
      setMessageInput(draftMessage.content)
      // Mark draft as applied so we don't keep re-applying
      setDraftApplied(true)
      // Clear the draft from context
      setDraftMessage(null)
    }
  }, [draftMessage, draftApplied, setDraftMessage])

  // Mark thread as read when selected
  useEffect(() => {
    if (currentUser && selectedThread) {
      markThreadAsRead(currentUser.id, selectedThread)
    }
  }, [currentUser, selectedThread, markThreadAsRead])

  const handleSendMessage = () => {
    if (!currentUser || !selectedThread || !messageInput.trim()) return

    const contact = availableContacts.find((c) => c.id === selectedThread)
    if (!contact) return

    sendMessage(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      contact.id,
      contact.name,
      contact.role,
      messageInput.trim(),
      "direct"
    )
    setMessageInput("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    } else if (days === 1) {
      return "Yesterday"
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" })
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "supervisor":
        return "default"
      case "navigator":
        return "secondary"
      case "biller":
        return "secondary"
      case "patient":
        return "outline"
      default:
        return "outline"
    }
  }

  const filteredThreads = threads.filter((thread) =>
    thread.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!currentUser) return null

  // Don't show messaging for executives
  if (currentUser.role === "executive") {
    return (
      <Card className="h-[calc(100vh-12rem)]">
        <CardContent className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Messaging is not available for Executive users.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-[320px_1fr] gap-4">
      {/* Thread List */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredThreads.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.partnerId}
                  type="button"
                  onClick={() => setSelectedThread(thread.partnerId)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
                    selectedThread === thread.partnerId
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(
                      thread.partnerRole === "supervisor" && "bg-primary/20 text-primary",
                      thread.partnerRole === "navigator" && "bg-blue-100 text-blue-700",
                      thread.partnerRole === "patient" && "bg-amber-100 text-amber-700",
                      thread.partnerRole === "biller" && "bg-emerald-100 text-emerald-700"
                    )}>
                      {getInitials(thread.partnerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{thread.partnerName}</span>
                      {thread.lastMessage.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(thread.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(thread.partnerRole)} className="text-[10px] px-1.5 py-0">
                        {thread.partnerRole}
                      </Badge>
                      {thread.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {thread.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {thread.lastMessage.type === "nudge" && (
                        <Bell className="mr-1 inline h-3 w-3" />
                      )}
                      {thread.lastMessage.content}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat Window */}
      <Card className="flex flex-col overflow-hidden">
        {selectedThread && selectedContact ? (
          <>
            {/* Chat Header */}
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(
                      selectedContact.role === "supervisor" && "bg-primary/20 text-primary",
                      selectedContact.role === "navigator" && "bg-blue-100 text-blue-700",
                      selectedContact.role === "patient" && "bg-amber-100 text-amber-700",
                      selectedContact.role === "biller" && "bg-emerald-100 text-emerald-700"
                    )}>
                      {getInitials(selectedContact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedContact.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedContact.subtitle || selectedContact.role}
                    </p>
                  </div>
                </div>
                <Badge variant={getRoleBadgeVariant(selectedContact.role)}>
                  {selectedContact.role}
                </Badge>
              </div>
            </CardHeader>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {currentThreadMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-12 text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  currentThreadMessages.map((msg) => {
                    const isOwn = msg.senderId === currentUser.id
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-4 py-2",
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                            msg.type === "nudge" && !isOwn && "border-l-4 border-amber-500 bg-amber-50"
                          )}
                        >
                          {msg.type === "nudge" && msg.patientName && msg.patientId && (
                            <button
                              type="button"
                              onClick={() => navigateTo("patient-detail", { patientId: msg.patientId })}
                              className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 hover:underline transition-colors"
                            >
                              <Bell className="h-3 w-3" />
                              <span>Re: {msg.patientName}</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.type === "nudge" && msg.patientId && (
                            <button
                              type="button"
                              onClick={() => navigateTo("patient-detail", { patientId: msg.patientId })}
                              className="mt-3 flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md transition-colors"
                            >
                              <User className="h-3 w-3" />
                              View Patient Record
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-1 text-xs",
                              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <CardContent className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm">Choose a contact from the list to start messaging</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
