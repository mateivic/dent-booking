import { redirect } from "next/navigation";

// The admin home is the dashboard. This route only renders for an authenticated
// admin (the (protected) layout gates it), so hitting /admin always forwards to
// /admin/dashboard.
export default function AdminIndex() {
    redirect("/admin/dashboard");
}
