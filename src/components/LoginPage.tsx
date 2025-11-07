import { useState } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import CustomSignUp from './CustomSignUp'
import logo from '../assets/altairium-logo.png'

export default function LoginPage() {
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-2 border-black rounded-xl flex items-center justify-center">
              <img src={logo} alt="Altairium Logo" className="w-8 h-8" />
            </div>
            <span className="text-black font-bold text-2xl">Altairium</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {view === 'sign_in' ? 'Sign in to your account' : 'Create your account'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Access your Grant Writing Tool
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {view === 'sign_up' ? (
            <CustomSignUp onToggleView={() => setView('sign_in')} />
          ) : (
            <>
              <style>
                {`
                  /* Hide ALL anchor tags in the Supabase Auth UI except forgot password */
                  .supabase-auth-ui_ui-anchor:not([href*="forgot"]) {
                    display: none !important;
                  }
                  /* Alternative selectors to ensure the sign up link is hidden */
                  .supabase-auth-ui_ui-anchor[href*="sign_up"],
                  .supabase-auth-ui_ui-anchor[href="#auth-sign-up"],
                  .supabase-auth-ui_ui a[href*="sign_up"],
                  .supabase-auth-ui_ui a[href="#auth-sign-up"] {
                    display: none !important;
                  }
                `}
              </style>
              <Auth
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: '#2563eb',
                        brandAccent: '#1d4ed8',
                      },
                    },
                  },
                  className: {
                    anchor: 'text-blue-600 hover:text-blue-500',
                    button: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg',
                    input: 'mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    label: 'block text-sm font-medium text-gray-700',
                  },
                }}
                view="sign_in"
                showLinks={false}
                // providers={['google', 'github']}
                providers={[]}
                redirectTo={window.location.origin}
              />
              <div className="mt-4 space-y-2 text-center">
                <div>
                  <button
                    onClick={async () => {
                      const email = prompt('Enter your email address:')
                      if (email) {
                        await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        })
                        alert('Password reset link sent! Check your email.')
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Forgot your password?
                  </button>
                </div>
                <div>
                  <button
                    onClick={() => setView('sign_up')}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Don't have an account? Sign up
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}