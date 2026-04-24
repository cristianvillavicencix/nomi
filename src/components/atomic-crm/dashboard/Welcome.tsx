import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Welcome = () => (
  <Card>
    <CardHeader className="px-4">
      <CardTitle>Your CRM starter kit</CardTitle>
    </CardHeader>
    <CardContent className="px-4">
      <p className="text-sm mb-4">
        <span className="font-medium">Nomi CRM</span> helps you run your
        business: contacts, projects, and team workflows in one place.
      </p>
      <p className="text-sm mb-4">
        This demo runs on a mock API, so you can explore and modify the data. It
        resets on reload. The full version uses Supabase for the backend.
      </p>
      <p className="text-sm">
        Powered by{" "}
        <a
          href="https://marmelab.com/shadcn-admin-kit"
          className="underline hover:no-underline"
        >
          shadcn-admin-kit
        </a>
        .
      </p>
    </CardContent>
  </Card>
);
