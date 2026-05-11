export const uiControlClass = {
  select:
    'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100',
  inputText:
    'text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400'
}

export const uiControlUi = {
  input: {
    base: 'bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500'
  },
  timeInput: {
    base: 'h-10 bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500'
  }
}

export function selectWidth(baseClass: string, widthClass = 'w-[220px]') {
  return baseClass.replace('w-full', widthClass)
}
