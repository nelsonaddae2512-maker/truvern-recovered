import React from "react";

export default function VendorCard({ name = "Acme Inc.", score = "A+" }) {
  return (
    <div style={{
      padding: "1rem",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      background: "#ffffff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      maxWidth: "300px",
      textAlign: "center"
    }}>
      <h3 style={{ margin: 0, color: "#111827" }}>{name}</h3>
      <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>Trust Score: {score}</p>
    </div>
  );
}

