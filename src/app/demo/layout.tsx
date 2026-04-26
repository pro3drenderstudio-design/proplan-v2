export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", width: "100%", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
