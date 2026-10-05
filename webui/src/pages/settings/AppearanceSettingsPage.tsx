import SettingsSectionLayout from "./SettingsSectionLayout";

export default function AppearanceSettingsPage() {
  return (
    <SettingsSectionLayout title="Appearance">
      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">Appearance</p>
          <p className="text-small text-muted-foreground">
            Theme preferences and visual customization.
          </p>
        </div>

        <div className="px-4 py-4">
          <p className="text-small text-muted-foreground">
            Coming soon: theme controls, density options, and appearance
            preferences.
          </p>
        </div>
      </div>
    </SettingsSectionLayout>
  );
}
