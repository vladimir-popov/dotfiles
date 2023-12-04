set guifont=FiraCode_Nerd_Font:h13
" set guifont=Hack_Nerd_Font:h14

set spelllang=ru,en
" autocmd FileType markdown,txt setlocal spell spelllang=ru,en

" use markers for folding
set foldmethod=marker

set background=light 
colorscheme PaperColor
" colorscheme dawnfox

set wrap
set linebreak
set linespace=3


if exists("g:neovide")
  let g:neovide_input_macos_alt_is_meta=v:false
  let g:neovide_cursor_vfx_mode = "ripple"
  " let g:neovide_cursor_vfx_mode = "railgun"
  let g:neovide_cursor_vfx_particle_lifetime=0.5
  let g:neovide_cursor_trail_size=0.3
  let g:neovide_cursor_animation_length=0.10
endif
