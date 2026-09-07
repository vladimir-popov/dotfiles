let g:zig_fmt_autosave = 0
set cc=120
set textwidth=100
set tags=./tags;,tags
command! -buffer Ctags silent !ctags -R --exclude=.git --exclude=zig-cache --exclude=zig-out .
command! -buffer Zfmt silent !zig fmt %

nnoremap <buffer> <leader>tg :Ctags<CR>
nnoremap <buffer> <leader>F :Zfmt<CR>
nnoremap <F10> :cclose<Bar>compiler zig_build<Bar>silent make<Bar>bel copen<CR>

" see https://neovim.io/doc/user/quickfix.html#error-file-format
ca mks compiler zig_test<bar>silent make<bar>bel copen
ca mk cclose<bar>compiler zig_build<bar>silent make<bar>bel copen
ca mkt compiler zig_build<bar>silent make test<bar>bel copen
ca me compiler zig_build<bar>silent make -Doptimize=ReleaseFast emulate<bar>bel copen
