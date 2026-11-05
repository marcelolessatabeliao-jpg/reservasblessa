import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-3 select-none w-full", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
        month: "space-y-3 w-full",
        caption: "flex justify-center pt-1 relative items-center mb-2 w-full",
        caption_label: "text-sm sm:text-base font-black text-emerald-950 uppercase tracking-wider",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-emerald-50 text-emerald-900 border-2 border-emerald-200 hover:border-amber-400 hover:bg-amber-400 hover:text-slate-950 rounded-xl p-0 transition-all shadow-xs",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between w-full border-b border-emerald-100 pb-2 mb-2",
        head_cell: "text-emerald-900/80 rounded-md w-8 sm:w-9 font-black text-[0.75rem] sm:text-xs uppercase text-center flex-1",
        row: "flex w-full mt-1.5 justify-between",
        cell: "h-8 w-8 sm:h-9 sm:w-9 text-center text-sm p-0 relative flex-1 flex items-center justify-center focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }), 
          "h-8 w-8 sm:h-9 sm:w-9 p-0 font-bold rounded-xl transition-all duration-200 border border-transparent text-slate-900 hover:!text-slate-950 hover:!font-black hover:!bg-emerald-200 hover:!border-emerald-500 hover:scale-105"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-amber-400 !text-slate-950 !font-black !border-2 !border-amber-500 shadow-md scale-110 hover:!bg-amber-500 hover:!text-slate-950 focus:!bg-amber-400 focus:!text-slate-950",
        day_today: "border-2 border-emerald-500 text-emerald-950 font-black bg-emerald-50/60",
        day_outside:
          "day-outside text-slate-300 opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-slate-300 opacity-30 cursor-not-allowed hover:bg-transparent hover:scale-100 hover:border-transparent",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4 stroke-[3]" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4 stroke-[3]" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
