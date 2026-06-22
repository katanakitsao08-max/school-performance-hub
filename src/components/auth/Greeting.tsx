import { useEffect, useState } from 'react';

function getGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good Morning.';
  if (h < 18) return 'Good Afternoon.';
  return 'Good Evening.';
}

export function Greeting() {
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-primary-foreground animate-fade-in">
      <p className="text-2xl sm:text-3xl font-display font-semibold opacity-90">{greeting}</p>
      <h1 className="text-3xl sm:text-4xl font-display font-extrabold mt-1">Welcome Back!</h1>
    </div>
  );
}
