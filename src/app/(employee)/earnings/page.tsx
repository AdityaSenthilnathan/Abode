import { assertRole } from "@/server/auth/guard";
import { getPayoutCard, listCompletedEarnings } from "@/server/services/earnings";
import { EarningsDashboard } from "@/components/handyman/earnings-dashboard";
import { NotConnected } from "@/components/not-connected";

export default async function EarningsPage() {
  const user = await assertRole("employee");
  let earnings: Awaited<ReturnType<typeof listCompletedEarnings>> = [];
  let payout: Awaited<ReturnType<typeof getPayoutCard>> = null;
  let dbReady = true;
  try {
    [earnings, payout] = await Promise.all([listCompletedEarnings(user.id), getPayoutCard(user.id)]);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="text-sm opacity-60">Your revenue, paid-out jobs, and payout method.</p>
      </div>
      {!dbReady ? <NotConnected /> : <EarningsDashboard earnings={earnings} payout={payout} />}
    </div>
  );
}
