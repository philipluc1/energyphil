// A business detail from lib/about.ts, or a highlighted placeholder while it's
// still empty, so missing details are obvious on the policy pages.

export function Fill({ value, label }: { value: string; label: string }) {
  if (value) return <>{value}</>;
  return (
    <mark style={{ background: "#fff1c2", color: "#6b4a00", padding: "0 4px", borderRadius: 4, fontWeight: 700 }}>
      [{label}]
    </mark>
  );
}

/** A mailto link for an address from lib/about.ts, or a placeholder. */
export function MailLink({ email, label }: { email: string; label: string }) {
  if (!email) return <Fill value="" label={label} />;
  return <a href={`mailto:${email}`}>{email}</a>;
}
