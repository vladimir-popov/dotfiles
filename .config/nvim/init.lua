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
vim.opt.foldcolumn = '2'

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

-- turn on 'global' statusline
vim.opt.laststatus = 3

-- always show sign column 
-- (for git hunks and lsp errors)
vim.o.signcolumn = "yes"

-- do not wrap lines
vim.opt.wrap = false

-- searching configuration:
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- open all folds on the start
vim.opt.foldenable = false

-- use syntax for folding by default
vim.opt.foldmethod = 'syntax'

-- Expand TABs to spaces.
vim.opt.expandtab = true

-- Set the width of a TAB.
vim.opt.tabstop = 2

-- Indents will have a width of:
vim.opt.shiftwidth = 2

-- Sets the number of columns for a TAB:
vim.opt.softtabstop = 2

-- Set default textwidth
vim.opt.textwidth = 100

-- Do not comment a new line
--  t       Auto-wrap text using textwidth
--  c       Auto-wrap comments using textwidth, 
--          inserting the current comment
--          leader automatically.
--  r       Automatically insert the current comment leader after hitting
--          <Enter> in Insert mode.
--  o       Automatically insert the current comment leader after hitting 
--          'o' or 'O' in Normal mode.
vim.opt.formatoptions:remove({'c', 'r', 'o'})

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
    callback = function()
        if vim.fn.mode() ~= 'c' and vim.fn.expand('%') ~= '[Command Line]' then
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
                'matchit',
                'matchparen',
                'netrwPlugin',
                'tarPlugin',
                'tohtml',
                'tutor',
                'zipPlugin',
            },
        },
    },
    -- debug = true,
})

vim.cmd('colorscheme catppuccin')
