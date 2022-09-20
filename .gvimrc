set guifont=FiraCode_Nerd_Font:h14

" set spell spelllang=ru,en
autocmd FileType markdown,txt setlocal spell spelllang=ru,en

" use markers for folding
set foldmethod=marker

set background=light  
colorscheme PaperColor

set wrap
set linebreak


if exists("g:neovide")
  let g:neovide_input_macos_alt_is_meta=v:false
  let g:neovide_cursor_vfx_mode = "ripple"
  " let g:neovide_cursor_vfx_mode = "railgun"
  let g:neovide_cursor_vfx_particle_lifetime=1.2
  let g:neovide_cursor_trail_size=0.8
  let g:neovide_cursor_animation_length=0.15
endif
