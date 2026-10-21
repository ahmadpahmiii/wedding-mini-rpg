/**
 * What a guest said in their RSVP, never whether they turned up: "AKAN HADIR",
 * not "HADIR". The party size stays with the couple and is not shown.
 */
export function AttendanceChip({ attending }: { attending: boolean }) {
  return attending ? (
    <span className="inline-flex w-max items-center rounded-full border-[1.5px] border-emerald-500
                     bg-emerald-100 px-3 py-[5px] text-[11px] font-bold tracking-[1.4px] text-emerald-500">
      AKAN HADIR
    </span>
  ) : (
    <span className="inline-flex w-max items-center rounded-full border-[1.5px] border-rose-700
                     bg-rose-100 px-3 py-[5px] text-[11px] font-bold tracking-[1.4px] text-rose-700">
      TIDAK HADIR
    </span>
  );
}
