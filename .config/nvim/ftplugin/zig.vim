let g:zig_fmt_autosave = 0
set cc=120
" see https://neovim.io/doc/user/quickfix.html#error-file-format
ca mks compiler zig_test<bar>silent make<bar>bel copen
ca mk compiler zig_build_compile<bar>silent make<bar>bel copen
ca me compiler zig_build_compile<bar>silent make -Doptimize=ReleaseFast emulate<bar>bel copen
