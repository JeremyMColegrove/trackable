import { AppBrand } from "@/components/app-brand"
import { WorkspaceSwitcher } from "@/app/[locale]/dashboard/workspace-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function SidebarShell({
  children,
  href,
  footer,
  workspaceSelectorEyebrow,
  ...props
}: {
  children: React.ReactNode
  href: string
  footer?: React.ReactNode
  workspaceSelectorEyebrow?: React.ReactNode
} & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b p-4">
        <AppBrand href={href} />
      </SidebarHeader>
      <SidebarContent>{children}</SidebarContent>
      <SidebarFooter className="border-t px-3 py-3">
        <div className="space-y-2">
          {workspaceSelectorEyebrow ? (
            <div className="px-2 text-[10px] font-medium tracking-wider text-sidebar-foreground/50 uppercase">
              {workspaceSelectorEyebrow}
            </div>
          ) : null}
          <WorkspaceSwitcher triggerClassName="w-full justify-between" />
          {footer}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
