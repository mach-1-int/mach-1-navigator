"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Construction, ArrowLeft, Wrench } from "lucide-react"
import { useRole } from "@/lib/role-context"

interface InDevelopmentProps {
  title: string
  description?: string
}

export function InDevelopment({ title, description }: InDevelopmentProps) {
  const { goBack } = useRole()

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md border-dashed border-2 border-muted-foreground/25 bg-card">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Construction className="h-10 w-10 text-muted-foreground" />
          </div>
          
          <h2 className="mb-2 text-xl font-semibold text-card-foreground">{title}</h2>
          
          <p className="mb-6 text-muted-foreground">
            {description || "This feature is currently under development and will be available soon."}
          </p>
          
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground mb-6">
            <Wrench className="h-4 w-4" />
            <span>Coming Soon</span>
          </div>
          
          <Button onClick={goBack} variant="outline" className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
