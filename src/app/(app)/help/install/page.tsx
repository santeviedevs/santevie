import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// One-page install guide for field staff, linked from the app shell's
// secondary nav. Static content — no permission required beyond being
// signed in, which the (app) layout already enforces.
export const dynamic = "force-dynamic";

export default function InstallGuidePage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Install ALISONS on your phone</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the app to your home screen so it opens in one tap, like an installed app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Android (Chrome)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-4 text-sm">
            <li>Open this site in Chrome.</li>
            <li>
              Tap the menu button (⋮) in the top right, then choose{" "}
              <strong>Add to Home screen</strong>.
            </li>
            <li>
              Confirm the name and tap <strong>Add</strong>.
            </li>
            <li>Open ALISONS from the icon on your home screen from now on.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">iPhone (Safari)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-4 text-sm">
            <li>Open this site in Safari — it will not work from Chrome on iPhone.</li>
            <li>Tap the Share button (the square with an arrow) at the bottom of the screen.</li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> in the top right.
            </li>
            <li>Open ALISONS from the icon on your home screen from now on.</li>
          </ol>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Trouble installing? Ask your supervisor or contact the office for help.
      </p>
    </div>
  );
}
