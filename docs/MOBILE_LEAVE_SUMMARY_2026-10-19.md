# Mobile employee leave summary

Below 768px, LeaveSummaryForm now shows a mobile summary instead of the fixed 1,180px print preview. The bottom sheet uses dynamic viewport height and safe-area padding. A sticky toolbar keeps separate 44px Print and Close controls accessible while scrolling.

The summary includes employee identity, total credits, available SL/VL (and AL when credited), expandable employee details, and chronological leave cards. Cards show status, dates, duration, and reason; approval details and HR remarks can be expanded. The 40-record limit matches the existing print form, with an explicit notice when more records exist. Empty histories show a readable empty state rather than forty blank rows.

The desktop preview retains its two sheets. Printing still uses the existing isolated iframe with two A4 portrait pages and twenty rows per page; mobile cards and controls are excluded. The summary shell now participates in DialogOverlay's focus trap, Escape handling, and opener focus restoration.

Validation: seven component/print tests, TypeScript and production build, and twelve browser cases at 320, 390, 718, 767, 768, and 1440 pixels in dark/light themes. Browser checks verify overflow, 44px touch targets, sticky toolbar access, expandable details, two-page/40-row print source, close and focus restoration, and no API writes. The exported print PDF has two portrait A4 pages.
