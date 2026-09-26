import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader label="Settings" title="Settings" />
      <SettingsTabs />
      <div className="pt-8">{children}</div>
    </>
  );
}
