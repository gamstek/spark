/** Decorative aiming guide; scanner status is announced by the page. */
export function ScanFrame() {
  return (
    <div
      className="staff-scan-frame"
      aria-hidden="true"
    >
      <span className="staff-scan-corner staff-scan-corner-top-left" />
      <span className="staff-scan-corner staff-scan-corner-top-right" />
      <span className="staff-scan-corner staff-scan-corner-bottom-left" />
      <span className="staff-scan-corner staff-scan-corner-bottom-right" />
      <span className="staff-scan-line" />
    </div>
  );
}
