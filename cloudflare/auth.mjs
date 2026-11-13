import { betterAuth } from 'better-auth';

export function createAuth(env, ctx) {
  const emailEnabled = env.AUTH_EMAIL_ENABLED === 'true' && !!env.EMAIL && !!env.EMAIL_FROM;
  const sendEmail = (to, subject, url) => {
    const task = env.EMAIL.send({ from: env.EMAIL_FROM, to, subject,
      text: subject + '\n\nAbre este enlace para continuar:\n' + url + '\n\nSi no lo solicitaste, ignora este correo.' });
    ctx.waitUntil(task.catch(() => console.error('No se pudo enviar un correo de acceso.')));
  };
  return betterAuth({
    database: env.DB, secret: env.BETTER_AUTH_SECRET, baseURL: env.APP_ORIGIN,
    trustedOrigins: [env.APP_ORIGIN], telemetry: { enabled: false }, logger: { disabled: true },
    emailAndPassword: {
      enabled: emailEnabled, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendEmail(user.email, 'Recupera el acceso a SalvaTuCurso', url)
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendEmail(user.email, 'Confirma tu correo en SalvaTuCurso', url)
    },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account', requireEmailVerification: true }
    } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 50,
      customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 3 }, '/request-password-reset': { window: 60, max: 3 } } },
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] }, backgroundTasks: { handler: promise => ctx.waitUntil(promise) } }
  });
}
