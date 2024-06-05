if exists('current_compiler')
  finish
endif
let current_compiler = 'scala_bloop'

let s:save_cpo = &cpo
set cpo&vim


if exists(':CompilerSet') != 2
  command -nargs=* CompilerSet setlocal <args>
endif

CompilerSet makeprg=bloop\ compile\ --no-color
CompilerSet efm=%E\[E\]\ \[E%.%#\]\ %f:%l:%c,%C%m,%C%.%#,%Z%.%#

let &cpo = s:save_cpo
unlet s:save_cpo
" vim: tabstop=8 shiftwidth=4 softtabstop=4 expandtab

