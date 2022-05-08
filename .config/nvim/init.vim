set runtimepath+=~/.vim runtimepath+=~/.vim/after
let &packpath = &runtimepath
source ~/.vimrc

" a comma separated list of options for Insert mode completion
" menuone  - use a popup menu to show the possible completions,
"            also when there is only one match;
" noinsert - do not insert any text for a match until the user
"            selects a match from the menu;
set completeopt=menuone,noinsert
" Avoid showing message extra message when using completion
set shortmess+=c
" Ensure autocmd works for Filetype
set shortmess-=F
" speedup used for the CursorHold autocommand event:
set updatetime=300

" turn on 'global' statusline
set laststatus=3

let g:neoformat_verbose = 0
let g:neoformat_lua_stylua = {
      \ 'exe': 'stylua',
      \ 'args': ['--config-path ', $HOME .. '/.stylua.default', '--', '-'],
      \ 'stdin': 1,
      \ }
let g:neoformat_enabled_lua = ['stylua']

lua require'conf.plugins'
lua require'conf.cmp'.setup()
lua require'conf.telescope'
lua require'conf.filetree'.setup()
lua require'conf.setup_lsp'
lua require'conf.sumneko'
lua require'conf.metals'
lua require'conf.treesitter'
