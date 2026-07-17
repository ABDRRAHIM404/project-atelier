import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
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
      <SignIn path="/sign-in" routing="path" />
    </main>
  );
}
