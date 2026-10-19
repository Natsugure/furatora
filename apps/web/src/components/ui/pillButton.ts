// 丸いボタン（ボタンとリンクの両方に当てる）。エラー・見つからない画面で使う
const pillButtonBase = 'inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full text-sm font-bold transition-colors';

// 塗りのボタン（主の操作）
export const pillButtonPrimary = `${pillButtonBase} bg-brand-600 hover:bg-brand-700 text-white`;

// 白いボタン（トップページに戻るなど）
export const pillButtonSecondary = `${pillButtonBase} bg-surface shadow-raised text-brand-600 hover:text-brand-700`;
