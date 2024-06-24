vim.opt.termguicolors = true

-- use UTF as encoding by default
vim.opt.encoding = 'UTF-8'

-- turn on spellcheck
vim.opt.spell = true
vim.opt.spelllang = { 'ru', 'en' }
vim.opt.sps = { 'best', 5 }

-- highlight the current line
vim.opt.cursorline = true

-- turn on line numbers
vim.opt.number = true

-- the minimal width of the left column
vim.o.foldcolumn = '2'
vim.o.foldlevel = 99 -- Using ufo provider need a large value, feel free to decrease the value
vim.o.foldlevelstart = 99
vim.o.foldenable = true

-- turn relative line numbers on only for active window
-- and not in diff mode
local togglenumber = vim.api.nvim_create_augroup('togglenumber', { clear = true })
vim.api.nvim_create_autocmd({ 'BufEnter', 'FocusGained', 'InsertLeave' }, {
    group = togglenumber,
    pattern = '*',
    callback = function()
        if vim.o.number and vim.fn.mode() ~= 'i' and not vim.o.diff then
            vim.o.rnu = true
        end
    end,
})
vim.api.nvim_create_autocmd({ 'BufLeave', 'FocusLost', 'InsertEnter', 'WinLeave' }, {
    group = togglenumber,
    pattern = '*',
    callback = function()
        if vim.o.number then
            vim.o.rnu = false
        end
    end,
})

-- turn on undo history
vim.cmd([[
set undodir=~/.vim/undodir
set undofile
set undolevels=1000
set undoreload=10000
]])

-- use rg as grep
vim.cmd([[
set grepprg=rg\ --vimgrep\ --no-heading\ --smart-case
set grepformat+=%f:%l:%c:%m
]])

-- turn on 'global' statusline
vim.opt.laststatus = 3

-- always show sign column
-- (for git hunks and lsp errors)
vim.o.signcolumn = 'yes'

-- do not wrap lines
vim.opt.wrap = false

-- searching configuration:
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- use syntax for folding by default
vim.opt.syntax = 'on'
-- vim.opt.foldmethod = 'syntax'

-- open all folds on the start
-- vim.opt.foldenable = false

vim.api.nvim_create_autocmd({ 'BufNewFile', 'BufRead' }, {
    pattern = { '*' },
    callback = function()
        -- Do not comment a new line
        --  t       Auto-wrap text using textwidth
        --  c       Auto-wrap comments using textwidth,
        --          inserting the current comment
        --          leader automatically.
        --  r       Automatically insert the current comment leader after hitting
        --          <Enter> in Insert mode.
        --  o       Automatically insert the current comment leader after hitting
        --          'o' or 'O' in Normal mode.
        vim.opt.formatoptions:remove({ 'c', 'r', 'o' })
    end,
})

-- a comma separated list of options for Insert mode completion
-- menuone  - use a popup menu to show the possible completions,
--            also when there is only one match;
-- noinsert - do not insert any text for a match until the user
--            selects a match from the menu;
vim.opt.completeopt = { 'menuone', 'noinsert' }
-- Avoid showing message extra message when using completion
vim.opt.shortmess:append('c')
-- Ensure autocmd works for Filetype
vim.opt.shortmess:remove('F')
-- speedup used for the CursorHold autocommand event:
vim.opt.updatetime = 300

-- auto-reload files when modified externally
-- https://unix.stackexchange.com/a/383044
vim.o.autoread = true
vim.api.nvim_create_autocmd({ 'BufEnter', 'CursorHold', 'CursorHoldI', 'FocusGained' }, {
    pattern = { '*' },
    callback = function(arg)
        if vim.fn.mode() ~= 'c' and vim.fn.getcmdwintype() == '' then
            vim.api.nvim_command('checktime')
        end
    end,
})

-- setup plugins
local lazypath = vim.fn.stdpath('data') .. '/lazy/lazy.nvim'
if not vim.loop.fs_stat(lazypath) then
    vim.fn.system({
        'git',
        'clone',
        '--filter=blob:none',
        '--single-branch',
        'https://github.com/folke/lazy.nvim.git',
        lazypath,
    })
end

vim.opt.runtimepath:prepend(lazypath)

require('lazy').setup('plugins', {
    defaults = { lazy = true },
    checker = { enabled = false },
    change_detection = { enabled = false },
    performance = {
        rtp = {
            disabled_plugins = {
                'gzip',
                'netrwPlugin',
                'tarPlugin',
                'tutor',
                'zipPlugin',
            },
        },
    },
    dev = {
        path = '~/Projects/nvim',
        -- patterns = { 'vladimir-popov' },
    },
    -- debug = true,
})

vim.cmd([[let g:catppuccin_flavour = $CATPPUCCIN]])
vim.cmd('colorscheme catppuccin')
-- vim.opt.background = 'dark'
-- vim.cmd([[hi Folded ctermfg=102 guifg=#878787 guibg=NONE ctermbg=NONE]])
