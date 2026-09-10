/** 扫码取景框：绿色四角 + 横向扫描线，静态示意。 */
export function ScanFrame() {
  const corner = 'absolute h-[41px] w-[41px] border-2 border-[#19D76A]';
  return (
    <div className="relative mx-auto h-[220px] w-[226px] rounded-lg">
      <div
        className={`${corner} left-0 top-0 border-r-0 border-b-0 rounded-tl-lg`}
      />
      <div
        className={`${corner} right-0 top-0 border-l-0 border-b-0 rounded-tr-lg`}
      />
      <div
        className={`${corner} bottom-0 left-0 border-r-0 border-t-0 rounded-bl-lg`}
      />
      <div
        className={`${corner} bottom-0 right-0 border-l-0 border-t-0 rounded-br-lg`}
      />
      <div className="absolute left-1/2 top-1/2 h-px w-[176px] -translate-x-1/2 -translate-y-1/2 bg-[#19D76A]/60" />
    </div>
  );
}
