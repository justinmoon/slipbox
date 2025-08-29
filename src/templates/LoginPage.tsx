import { Layout } from "./Layout";

export function LoginPage({ error }: { error?: string }) {
  return (
    <Layout title="Login - Slipbox">
      <div class="min-h-screen flex items-center justify-center">
        <div class="w-full max-w-md p-8">
          <div class="bg-off-white border-2 border-dark p-8 shadow-[5px_5px_0px_0px_#111]">
            <h1 class="text-3xl font-bold mb-8 text-center">Slipbox</h1>

            {error && (
              <div class="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 mb-6">
                {error}
              </div>
            )}

            <form method="POST" action="/login">
              <div class="mb-6">
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  autofocus
                  class="w-full px-4 py-3 border-2 border-dark focus:outline-none focus:shadow-[2px_2px_0px_0px_#111]"
                  placeholder="Enter password"
                />
              </div>

              <button
                type="submit"
                class="w-full bg-dark text-off-white py-3 px-4 font-medium hover:shadow-[3px_3px_0px_0px_#111] transition-shadow"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
