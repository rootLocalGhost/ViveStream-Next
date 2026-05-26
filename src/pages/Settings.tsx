export default function Settings() {
  return (
    <div style={{ padding: "40px", "max-width": "800px" }}>
      <h2
        style={{
          "font-family": "var(--font-display)",
          "font-size": "28px",
          "margin-bottom": "30px",
          display: "flex",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <i
          class="ph-fill ph-gear"
          style={{ "font-size": "32px", color: "var(--primary-accent)" }}
        ></i>{" "}
        Settings
      </h2>

      <div
        style={{
          background: "var(--secondary-background)",
          padding: "30px",
          "border-radius": "16px",
          border: "1px solid var(--border-color)",
          "box-shadow": "var(--shadow-color-heavy)",
        }}
      >
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                "font-family": "var(--font-body)",
                color: "var(--primary-text)",
              }}
            >
              General Configuration
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--secondary-text)",
                "font-size": "14px",
                "line-height": "1.5",
                "max-width": "500px",
              }}
            >
              Global preferences will be populated here in future updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
