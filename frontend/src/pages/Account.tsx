import { useAuth } from '../auth';
import { Layout } from '../components/Layout';
import { BillingCard } from '../components/BillingCard';

export function Account() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-white/90">Account</h1>

        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-medium text-white/40">
                {user?.name?.[0] || '?'}
              </div>
            )}
            <div>
              <p className="text-white/80 font-medium">{user?.name}</p>
              <p className="text-sm text-white/30">{user?.email}</p>
            </div>
          </div>
        </div>

        <BillingCard />
      </div>
    </Layout>
  );
}
