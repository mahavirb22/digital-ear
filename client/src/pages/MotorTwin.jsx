import React from "react";
import MotorTwinDashboard from "../components/MotorTwinDashboard";

function MotorTwin() {
  // Get device ID from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const deviceId = searchParams.get("deviceId");

  return (
    <MotorTwinDashboard
      deviceId={deviceId}
      apiBaseUrl="http://localhost:5000"
    />
  );
}

export default MotorTwin;
