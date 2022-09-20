" ***************************************************************************** 
" *                               Plugins                                     * 
" ***************************************************************************** 
" {{{
" PlugInstall [name ...] [#threads]	Install plugins
" PlugUpdate [name ...] [#threads]	Install or update plugins
" PlugClean[!]                  	Remove unlisted plugins
"
" Plugins will be downloaded under the specified directory.
call plug#begin('~/.vim/plugged')

" -- PaperColor Light -------------------------------------------------------{{{
" light/dark theme https://github.com/NLKNguyen/papercolor-theme
" https://github.com/NLKNguyen/papercolor-theme/blob/master/DESIGN.md
" http://www.calmar.ws/vim/256-xterm-24bit-rgb-color-chart.html
let g:PaperColor_Theme_Options = {
  \   'theme': {
  \     'default.light': {
  \       'override' : {
  \         'color00' : ['#ffffff', '15'],
  \         'color05' : ['#9e9e9e', '247'],
  \         'color15' : ['#ffffff', '15'],
  \         'cursorline' : ['#eeeeee', '255'],
  \         'linenumber_bg' : ['#ffffff', '15']
  \       }
  \     }
  \   }
  \ }
Plug 'NLKNguyen/papercolor-theme'
" }}}

" -- Nightfox theme ---------------------------------------------------------{{{
Plug 'EdenEast/nightfox.nvim'
" }}}

" -- Auto-save --------------------------------------------------------------{{{
let g:auto_save = 1  " enable AutoSave on Vim startup
Plug '907th/vim-auto-save'
" }}}

" -- Commentary -------------------------------------------------------------{{{
" gc - for comment
Plug 'tpope/vim-commentary'
" }}}

" -- Surround ---------------------------------------------------------------{{{
" cs{from}{to} 'Hello w█rld!' cs't<a> <a>Hello world!</a>
" ds{"} 'Hello w█rld!' ds' Hello world!
" ys{move}{"}   'Hello w█rld!' ysiw[ 'Hello [world]!'
Plug 'tpope/vim-surround'
" }}}

" -- Lexima -----------------------------------------------------------------{{{
Plug 'cohama/lexima.vim'
" rules must be added outside of plugins section, so, check Settings section
" }}}

" -- tmux -------------------------------------------------------------------{{{
Plug 'christoomey/vim-tmux-navigator'
" }}}

" -- fzf --------------------------------------------------------------------{{{
let g:fzf_layout = { 'window': { 'width': 0.6, 'height': 0.9, 'relative': v:true } }
let g:fzf_preview_window = ['down:70%', 'ctrl-/']
let g:fzf_colors = {
      \ 'fg':      ['fg', 'Normal'],
      \ 'bg':      ['bg', 'Normal'],
      \ 'hl':      ['fg', 'Comment'],
      \ 'fg+':     ['fg', 'CursorLine', 'CursorColumn', 'Normal'],
      \ 'bg+':     ['bg', 'CursorLine', 'CursorColumn'],
      \ 'hl+':     ['fg', 'Identifier', 'Statement'],
      \ 'info':    ['fg', 'PreProc'],
      \ 'gutter':  ['bg', 'Normal'],
      \ 'border':  ['fg', 'FloatBorder'],
      \ 'prompt':  ['fg', 'Identifier'],
      \ 'pointer': ['fg', 'Identifier'],
      \ 'marker':  ['fg', 'Identifier'],
      \ 'spinner': ['fg', 'Label'],
      \ 'header':  ['fg', 'Comment'] }

Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'
nnoremap <nowait><space>a <cmd>Files<cr>
nnoremap <nowait><space>gg <cmd>Ag<cr>
nnoremap <nowait><space>gf <cmd>GFiles<cr>
nnoremap <nowait><space>gs <cmd>GFiles?<cr>
nnoremap <nowait><space>gc <cmd>Commits<cr>
nnoremap <nowait><space>gh <cmd>BCommits<cr>
nnoremap <nowait><space>f <cmd>BLines<cr>
nnoremap <nowait><space>o <cmd>History<cr>
nnoremap <nowait><space>w <cmd>Buffers<cr>
" }}}

" -- Git support ------------------------------------------------------------{{{ 
Plug 'tpope/vim-fugitive'
set updatetime=700
" git status
nnoremap <leader>gc :Git checkout<space>
" nnoremap <leader>gs :tabnew<bar>Git<CR><C-w>w:bd<CR>
nnoremap <leader>gs :Git<CR>
" git push
nnoremap <leader>gk :Git push
" git pull
nnoremap <leader>gj :Git pull
" git diff to resolve conflicts
nnoremap <leader>gr :Gvdiffsplit!<cr>
" `g`et changes `f`rom the current brunch (HEAD or LOCAL) - left buffer
nnoremap gfh :execute 'diffget ' .. (&diff ? 'LO' : '//2')<cr>
" `g`et changes `f`rom the merge branch (REMOTE) - right buffer
nnoremap gfl :execute 'diffget ' .. (&diff ? 'RE' : '//3')<cr>

" add marks about git status on the left line
Plug 'airblade/vim-gitgutter'
nnoremap <silent> ]h :GitGutterNextHunk<cr>
nnoremap <silent> [h :GitGutterPrevHunk<cr>
onoremap <silent> ih :GitGutterTextObjectInnerPending<cr>
onoremap <silent> ah :GitGutterTextObjectOuterPending<cr>
xnoremap <silent> ih :GitGutterTextObjectInnerVisual<cr>
xnoremap <silent> ah :GitGutterTextObjectOuterVisual<cr>

" preview the hunk
" <Leader>hp
" stage the hunk with 
" <Leader>hs
" undo it with 
" <Leader>hu
" ---------------------------------------------------------------------------}}}

" -- EasyMotion -------------------------------------------------------------{{{
Plug 'easymotion/vim-easymotion'
" let g:EasyMotion_do_mapping = 0 " Disable default mappings
map <space><space> <Plug>(easymotion-prefix)

hi EasyMotionTarget2First ctermbg=none ctermfg=red
hi EasyMotionTarget2Second ctermbg=none ctermfg=red

" nmap s <Plug>(easymotion-overwin-w)
" " Jump to anywhere you want with minimal keystrokes, with just one key binding.
" " `s{char}{label}`
" nmap f <Plug>(easymotion-overwin-f)
" " or
" " `s{char}{char}{label}`
" " Need one more keystroke, but on average, it may be more comfortable.
" nmap f <Plug>(easymotion-overwin-f2)
" " Turn on/off case-insensitive feature (0/1)
" let g:EasyMotion_smartcase = 1

" ---------------------------------------------------------------------------}}}"  
 
" -- TableMode --------------------------------------------------------------{{{
" To start using the plugin use :TableModeToggle
" You can visually select multiple lines and call :Tableize on it.
" :Tableize also accepts a range.
Plug 'dhruvasagar/vim-table-mode'

" For Markdown-compatible tables use:
let g:table_mode_corner='|'

" }}}

" -- Markdown ---------------------------------------------------------------{{{
" : MarkdownPreview
" : MarkdownPreviewStop
" : MarkdownPreviewToggle
" set to 1, the vim will auto close current preview window when change
" from markdown buffer to another buffer
" let g:mkdp_auto_close = 0
" let g:mkdp_browserfunc = 'g:Open_browser'
" Plug 'iamcco/markdown-preview.nvim', { 'do': 'cd app & yarn install'  }
" uncomment to change browser
" function! g:Open_browser(url)
"     silent exe 'silent !open -na "Google Chrome" ' . a:url
" endfunction

" }}}

" -- Yaml -------------------------------------------------------------------{{{
Plug 'stephpy/vim-yaml'
"  }}}

" -- Goyo -------------------------------------------------------------------{{{
Plug 'junegunn/goyo.vim'
"  }}}

" -- Vader ------------------------------------------------------------------{{{
Plug 'junegunn/vader.vim'
"  }}}

" -- Translate --------------------------------------------------------------{{{
let g:translate_source = "en"
let g:translate_target = "ru"
let g:translate_popup_window = 1

Plug 'skanehira/translate.vim'  

vmap <c-t> <Plug>(VTranslate)
"  }}}

" -- LanguageTool -----------------------------------------------------------{{{
" :LanguageToolCheck to check grammar in the current buffer.
" :lne to jump to the next error
Plug 'dpelle/vim-LanguageTool'
" }}}

" -- My own plugins ---------------------------------------------------------{{{ 
" Io lang
Plug 'vladimir-popov/vim-iolanguage'

" Find & replace 
Plug 'vladimir-popov/vim-replace'

" Helps to write vim-help files
Plug 'dokwork/vim-hp'

" Vim Navigator
Plug 'vladimir-popov/vim-navigator'
" ---------------------------------------------------------------------------}}}

" ***************************************************************************** 
"                         Plugins for Vim only
" ***************************************************************************** 
" {{{
if !has('nvim')

" -- Devicons: adds icons for files -----------------------------------------{{{
Plug 'ryanoasis/vim-devicons' 
if exists("g:loaded_webdevicons")
	call webdevicons#refresh()
endif
" }}}

" -- Statusline -------------------------------------------------------------{{{
" show opened buffers on the top
let g:airline#extensions#tabline#enabled = 0
" move bar on top
"let g:airline_statusline_ontop=1
let g:airline_powerline_fonts = 0
Plug 'vim-airline/vim-airline'                  
Plug 'vim-airline/vim-airline-themes'
" let g:airline_section_y = airline#section#create(['tagbar', 'filetype'])
" }}}

" -- Buffers ----------------------------------------------------------------{{{
Plug 'ap/vim-buftabline'                  
" }}}
  
" -- The NERDTree is a file system explorer for the Vim editor --------------{{{
" show hidden files
let NERDTreeShowHidden=1
" map a specific key or shortcut to open FileTree
nnoremap <leader>' :NERDTreeToggle<cr>
nnoremap <leader>" :NERDTreeFind<cr>
Plug 'preservim/nerdtree'         
Plug 'Xuyuanp/nerdtree-git-plugin'
" }}}

endif
" }}}

call plug#end()
" }}}
 
" *****************************************************************************
" *                               Settings                                    *  
" ***************************************************************************** 
" {{{
set termguicolors
if exists('g:neovide')
  so ~/.gvimrc
  cd ~
else
  set background=dark
  colorscheme nightfox
  " Nightfox customization for difftool
  hi! DiffAdd guibg=#526176
  hi! DiffDelete guibg=#526176
  hi! DiffChange guibg=#526176
endif

" use UTF as encoding by default
set encoding=UTF-8

" use mouse in the terminal
set mouse=a

" turn on indent
filetype indent on

" Enable filetype plugins
filetype plugin on

" turn on line numbers
set number

" highlight the current line
set cursorline

" turn relative line numbers on only for active window
" and not in diff mode
augroup numbertoggle
  autocmd!
  autocmd BufEnter,FocusGained,InsertLeave,WinEnter * if &nu && mode() != "i" && !&diff  | set rnu   | endif
  autocmd BufLeave,FocusLost,InsertEnter,WinLeave   * if &nu                             | set nornu | endif
augroup END

" do not wrap lines
set nowrap

" searching configuration:
set ignorecase
set smartcase

" open all folds on the start
set nofoldenable

" use syntax for folding by default
set foldmethod=syntax

" Expand TABs to spaces.
set expandtab

" The width of a TAB is set to 2.
" Still it is a \t. It is just that
" vim will interpret it to be having
" a width of 2.
set tabstop=2

" Indents will have a width of 2.
set shiftwidth=2    

" Sets the number of columns for a TAB.
set softtabstop=2   

" Set default textwidth 
set textwidth=100

" do not comment new line
autocmd BufNewFile,BufRead * setlocal formatoptions-=ro

augroup my_luastyle
  autocmd!
  autocmd BufRead *.lua setlocal tabstop=4 | setlocal shiftwidth=4 | setlocal softtabstop=4 |
augroup END

" use russian keymapping in the normal mode
let ru_up='ФИСВУАПРШОЛДЬТЩЗЙКЫЕГМЦЧНЯЖХЪБЮЭ'
let en_up='ABCDEFGHIJKLMNOPQRSTUVWXYZ:{}<>\"'
let ru_low='фисвуапршолдьтщзйкыегмцчняёэхъжю'
let en_low="abcdefghijklmnopqrstuvwxyz§'[]\;."
execute "set langmap=" .. printf("%s;%s,%s;%s", ru_up, en_up, ru_low, en_low)
set keymap=russian-jcukenwin
set iminsert=0
set imsearch=0

" turn on spellcheck in some files by default
augroup my_spellcheckdefault 
  autocmd!
  autocmd BufRead COMMIT_EDITMSG,*.md setlocal spell | setlocal spelllang=ru,en
augroup END

" lua lexima rules to put `end` on the new line after cursor
call lexima#add_rule({'char': '<CR>', 'at': 'function()\%#', 'input_after': '<CR>end', 'filetype': 'lua'}) 
call lexima#add_rule({'char': '<CR>', 'at': 'then\%#', 'input_after': '<CR>end', 'filetype': 'lua'}) 
call lexima#add_rule({'char': '<CR>', 'at': 'do\%#', 'input_after': '<CR>end', 'filetype': 'lua'}) 
" See: https://github.com/cohama/lexima.vim/issues/129#issuecomment-1028725217
call lexima#add_rule({'char': '(', 'at': '\%#\S\|\S\%#'})
call lexima#add_rule({'char': '[', 'at': '\%#\S\|\S\%#'})
call lexima#add_rule({'char': '{', 'at': '\%#\S\|\S\%#'})
call lexima#add_rule({'char': '"', 'at': '\%#\S\|\S\%#'})
call lexima#add_rule({'char': "'", 'at': '\%#\S\|\S\%#'})
call lexima#add_rule({'char': '`', 'at': '\%#\S\|\S\%#'})
" }}} 
 
" *****************************************************************************
" *                               Key mappin                                  *  
" ***************************************************************************** 
" {{{
" use jj to comeback to the normal mode
inoremap jj <esc>
" toggle the wrapping a text
nnoremap <F2> :set wrap!<bar>set linebreak!<CR>
" toggle searci highlighting
nnoremap <F3> :set hlsearch!<CR>
" toggle conceallevel
nnoremap <F4> :call g:ToggleConceallevel()<CR>
" run current script
nnoremap <F5> :so % <bar> echo 'script has been invoked' <CR>
" toggle spellcheck
nnoremap <F7> :call g:ToggleSpellcheck()<CR>
" run LanguageTool 
nnoremap <F8> :LanguageToolCheck<CR> 

nnoremap <silent> qq :bp<bar>bd#<CR>
" close the current window
nnoremap <silent> qw :close<cr>
" close the current buffer and window
nnoremap <silent> qQ :bd<CR>
" force close the current buffer and window
nnoremap <silent> QQ :bd!<CR>
" close quickfix window
nnoremap <silent> qc :cclose<CR>
" close the help window
nnoremap <silent> qh :helpclose<cr>

" hotkeys to swap between buffers
nnoremap <silent> gb <C-^>
nnoremap <silent> [b :bprevious<CR> 
nnoremap <silent> ]b :bnext<CR>
" open new tab
" nnoremap <C-n> :tabnew<CR>
" hotkeys to swap between tabs
nnoremap <silent> [t :tabprevious<CR> 
nnoremap <silent> ]t :tabnext<CR>

" use ' to go to marked position
nnoremap ' `

" use ` to go to marked line
nnoremap ` '

" indent block without loosing selection
xnoremap < <gv
xnoremap > >gv

" move cursor up and down naturally by display
nnoremap j gj
nnoremap k gk

" copy to the clipboard
vnoremap <C-c> "+y
" past to the clipboard
nnoremap <C-c> "+p

" Y behave like the other capital letters
nnoremap Y y$

" use lead + d to delete without copy (copy to the _ register)
nnoremap <leader>d "_d
xnoremap <leader>d "_d

" Use `<leader>cd` to set current dir to the dir with current buffer
nnoremap <leader>cd :cd %:p:h<CR>:pwd<CR>

" Enter to the Normal mod in the terminal
tnoremap <leader><leader> <c-\><c-n>
" }}}
 
" *****************************************************************************
" *                      Custom commands and functions                        *  
" ***************************************************************************** 
" " {{{

" Distraction free mode
command! DistractionFree Goyo 110x100 | set nu | set rnu

" Run grip server to render current buffer
" see https://github.com/joeyespo/grip
command! MarkdownPreview call g:MarkdownPreview()
function! g:MarkdownPreview()
  let args = '--user=vladimir-popov' .. expand('%') .. ' 8080'
  if &filetype == 'markdown'
    if has('nvim')
      call execute('below 10split term://grip ' .. args)
    else
      call execute('bo term grip ' .. args)
    endif
  else
    echo 'Only for markdown. Not for ' .. &filetype
  endif
endfunction

function! g:ToggleConceallevel()
  if &conceallevel 
    setlocal conceallevel=0
  else
    setlocal conceallevel=3
  endif
  echom "conceallevel=" . &conceallevel
endfunction

function! g:ToggleSpellcheck()
  if &spell 
    set nospell
  else
    set spell spelllang=ru,en
  endif
endfunction  

" Turn on/off spellchecking
command! ToggleSpellCheck call g:ToggleSpellcheck()

" }}}

" fold this file by markers {{{
augroup myvimrc 
  autocmd!
  autocmd BufRead .vimrc setlocal foldmethod=marker | setlocal foldenable 
augroup END
" }}}
