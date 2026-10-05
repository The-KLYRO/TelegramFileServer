import SettingsSectionLayout from "./SettingsSectionLayout";

export default function StorageSettingsPage() {
  return (
    <SettingsSectionLayout title="Storage">
      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">Storage</p>
          <p className="text-small text-muted-foreground">
            Cache sizes and cleanup actions.
          </p>
        </div>

        <div className="px-4 py-4">
          <p className="text-small text-muted-foreground">
            Coming soon: clear thumbnail cache, clear downloaded media, and show
            cache sizes.
          </p>
        </div>
      </div>
    </SettingsSectionLayout>
  );
}
