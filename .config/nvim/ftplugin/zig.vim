let g:zig_fmt_autosave = 0
set cc=120
" see https://neovim.io/doc/user/quickfix.html#error-file-format
ca mk compiler zig_build_compile<bar>silent make test<bar>bel copen
ca mg compiler zig_build_compile<bar>silent make generate<bar>bel copen
ca mt compiler zig_custom_test_runner<bar>silent make<bar>bel copen
ca me compiler zig_build_compile<bar>silent make -Doptimize=ReleaseFast emulate<bar>bel copen
