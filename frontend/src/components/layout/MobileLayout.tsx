import { ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DarkModeToggle } from './MainLayout'

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
      {/* Mobile Header - matching desktop style */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link to="/" className="text-xl text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            &lt;
          </Link>
          <h1 className="text-xl font-semibold truncate">{projectName || 'Project'}</h1>
        </div>
        <DarkModeToggle />
      </header>

      {/* Tabbed Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-3 rounded-none flex-shrink-0">
          <TabsTrigger value="vibecode">Vibecode</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="vibecode" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <div className="h-full p-4 flex flex-col">
            {vibecodePanel}
          </div>
        </TabsContent>

        <TabsContent value="code" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <div className="h-full p-4 flex flex-col">
            {codePanel}
          </div>
        </TabsContent>

        <TabsContent value="tests" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
          <div className="h-full p-4 flex flex-col">
            {testPanel}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}