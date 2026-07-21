import { SignIn } from '@clerk/nextjs';

type SignInPageProps = Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const parameters = await searchParams;
  const requestedRedirect =
    typeof parameters.redirect_url === 'string' ? parameters.redirect_url : '/workspace';
  const safeRedirect = requestedRedirect.startsWith('/') ? requestedRedirect : '/workspace';

  return (
    <main
      id="main-content"
      style={{
        display: 'grid',
        minHeight: '100vh',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <SignIn
        fallbackRedirectUrl={safeRedirect}
        path="/sign-in"
        routing="path"
      />
    </main>
  );
}
