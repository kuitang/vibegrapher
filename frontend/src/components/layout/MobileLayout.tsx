import { ReactNode, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Menu, MoreVertical } from 'lucide-react'

interface MobileLayoutProps {
  vibecodePanel: ReactNode
  codePanel: ReactNode
  testPanel: ReactNode
  projectName?: string
}

export function MobileLayout({ vibecodePanel, codePanel, testPanel, projectName }: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState('vibecode')

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Header with Navigation */}
      <header className="border-b px-4 py-2 flex items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px]">
            <nav className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <a href="/" className="text-sm hover:underline">Home</a>
              <a href="/projects" className="text-sm hover:underline">Projects</a>
              <a href="/settings" className="text-sm hover:underline">Settings</a>
            </nav>
          </SheetContent>
        </Sheet>

        <span className="text-sm font-medium truncate flex-1 mx-2">
          {projectName || 'Project'}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="more-actions">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Save</DropdownMenuItem>
            <DropdownMenuItem>Run Tests</DropdownMenuItem>
            <DropdownMenuItem>Export</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Tabbed Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-3 rounded-none">
          <TabsTrigger value="vibecode">Vibecode</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="vibecode" className="h-full mt-0">
            <div className="h-full p-4">
              <Card className="h-full">
                {vibecodePanel}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="code" className="h-full mt-0">
            <div className="h-full p-4">
              <Card className="h-full">
                {codePanel}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tests" className="h-full mt-0">
            <div className="h-full p-4">
              <Card className="h-full">
                {testPanel}
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Bottom Action Drawer */}
      <Drawer>
        <DrawerTrigger asChild>
          <Button 
            className="rounded-none"
            variant="secondary"
            size="lg"
            data-testid="mobile-actions"
          >
            Actions
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <div className="p-4 space-y-4">
            <Button className="w-full" variant="default">
              Run Vibecode
            </Button>
            <Button className="w-full" variant="outline">
              Clear Console
            </Button>
            <Button className="w-full" variant="outline">
              View History
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}