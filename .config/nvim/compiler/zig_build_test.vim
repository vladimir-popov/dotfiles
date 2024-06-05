if exists('current_compiler')
  finish
endif
runtime compiler/zig.vim
let current_compiler = 'zig_build_test'

let s:save_cpo = &cpo
set cpo&vim


if exists(':CompilerSet') != 2
  command -nargs=* CompilerSet setlocal <args>
endif

CompilerSet makeprg=zig\ build\ test
CompilerSet shellpipe=2>&1\ \|\ grep\ 'failed:\\\\|(test)'\ \|\ grep\ -v\ testing.zig\ \|\ grep\ -v\ 'while\ exec'\ \|tee
CompilerSet efm=%Eerror:%m,%Z%f:%l:%c:%.%#

let &cpo = s:save_cpo
unlet s:save_cpo
" vim: tabstop=8 shiftwidth=4 softtabstop=4 expandtab
