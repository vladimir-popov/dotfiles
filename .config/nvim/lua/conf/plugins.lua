------------------------------------------------------------
-- Plugins
------------------------------------------------------------
vim.cmd([[packadd packer.nvim]])
require('packer').startup(function(use)
    -- packer can manage itself
    use({ 'wbthomason/packer.nvim', opt = true })
    -- colorschemes
    use('Th3Whit3Wolf/one-nvim')
    use({
        'catppuccin/nvim',
        as = 'catppuccin',
        config = function()
            vim.g.catppuccin_flavour = 'macchiato'
            require('catppuccin').setup({
                custom_highlights = {
                    LspReferenceRead = { bg = '#374b7e' },
                    LspReferenceText = { bg = '#374b7e' },
                    LspReferenceWrite = { bg = '#374b7e' },
                },
            })
        end,
        run = ':CatppuccinCompile',
    })
    -- icons with extended symbols
    use('kyazdani42/nvim-web-devicons')
    -- Colorize (:CccPick :CccConvert :CccHighlighterToggle)
    use({
        'uga-rosa/ccc.nvim',
        config = function()
            require('ccc').setup()
        end,
    })
    -- show indents
    use({ 'lukas-reineke/indent-blankline.nvim' })
    -- gitsigns
    use({
        'lewis6991/gitsigns.nvim',
        config = function()
            local gs = require('gitsigns')
            gs.setup({
                on_attach = function(bufnr)
                    local function map(mode, l, r, opts)
                        opts = opts or {}
                        opts.buffer = bufnr
                        vim.keymap.set(mode, l, r, opts)
                    end
                    -- Actions
                    map({ 'n', 'v' }, '<leader>hs', ':Gitsigns stage_hunk<CR>')
                    map({ 'n', 'v' }, '<leader>hr', ':Gitsigns reset_hunk<CR>')
                    map('n', '[h', gs.prev_hunk)
                    map('n', ']h', gs.next_hunk)
                    map('n', '<leader>hu', gs.undo_stage_hunk)
                    map('n', '<leader>hp', gs.preview_hunk)
                    map('n', '<leader>hb', function()
                        gs.blame_line({ full = true })
                    end)
                    map('n', '<leader>tb', gs.toggle_current_line_blame)
                    map('n', '<leader>hd', gs.diffthis)
                end,
            })
        end,
    })
    -- statusline
    use({
        'dokwork/feline-theme',
        requires = {
            'kyazdani42/nvim-web-devicons',
            'famiu/feline.nvim',
            'dokwork/lua-schema.nvim',
        },
        -- config = function()
        --     if vim.g.neovide then
        --         require('feline-theme').setup_statusline(require('feline-theme.example'))
        --     else
        --         require('feline-theme').setup_statusline(require('cosmosline'))
        --     end
        -- end,
    })
    use({
        'nvim-lualine/lualine.nvim',
        requires = { 'kyazdani42/nvim-web-devicons', opt = true },
        config = function()
            require('lualine').setup(require('lualine.cosmosline'))
        end,
    })
    -- barbar
    -- use({
    --     'romgrk/barbar.nvim',
    --     config = function()
    --         local nmap = require('utils').nmap
    --         nmap('<space>b', '<cmd>BufferPick<cr>')
    --         nmap('<space>1', '<cmd>BufferGoto 1<cr>')
    --         nmap('<space>2', '<cmd>BufferGoto 2<cr>')
    --         nmap('<space>3', '<cmd>BufferGoto 3<cr>')
    --         nmap('<space>4', '<cmd>BufferGoto 4<cr>')
    --         nmap('<space>5', '<cmd>BufferGoto 5<cr>')
    --     end,
    -- })
    -- Hop is similar to EasyMotion
    use({
        'phaazon/hop.nvim',
        branch = 'v2',
        config = function()
            local function nmap(key, cmd)
                vim.api.nvim_set_keymap(
                    'n',
                    key,
                    '<cmd>' .. cmd .. '<cr>',
                    { noremap = true, silent = true }
                )
            end
            nmap('gw', 'HopWord')
            nmap('<space><space>b', 'HopWordBC')
            nmap('<space><space>w', 'HopWordAC')
            require('hop').setup({})
        end,
    })
    -- prettyfier a code
    use('sbdchd/neoformat')
    -- Snippets
    use({
        'L3MON4D3/LuaSnip',
        tag = 'v1.*',
        config = function()
            require('luasnip').setup({
                enable_autosnippets = true,
            })
            local path = '~/.config/nvim/lua/snippets'
            require('luasnip.loaders.from_lua').lazy_load({ paths = path })
            vim.keymap.set('n', '<leader>L', function()
                require('luasnip.loaders.from_lua').load({ paths = path })
                print('Snippets have been updated.')
            end)
        end,
    })
    -- autocompletion
    use({
        'hrsh7th/nvim-cmp',
        requires = {
            'hrsh7th/cmp-buffer',
            'hrsh7th/cmp-path',
            'hrsh7th/cmp-nvim-lsp',
            'hrsh7th/cmp-nvim-lsp-signature-help',
            'onsails/lspkind-nvim',
            'saadparwaiz1/cmp_luasnip',
        },
    })
    -- better quickfix
    use('kevinhwang91/nvim-bqf')
    -- file tree
    use('kyazdani42/nvim-tree.lua')
    -- nnn
    use({
        'mcchrish/nnn.vim',
        config = function()
            vim.g['nnn#session'] = 'local'
            require('utils').nmap('<c-n>', '<cmd>NnnPicker<cr>')
            require('utils').nmap('<c-b>', '<cmd>NnnPicker %:p:h<cr>')
        end,
    })
    -- telescope
    use({
        'nvim-telescope/telescope.nvim',
        requires = { 'nvim-lua/plenary.nvim' },
    })
    -- lazygit
    use({
        'kdheepak/lazygit.nvim',
        config = function()
            vim.api.nvim_set_keymap(
                'n',
                '<leader>gs',
                '<cmd>LazyGit<cr>',
                { noremap = true, silent = true }
            )
        end,
    })
    -- treesitter
    use({
        'nvim-treesitter/nvim-treesitter',
        run = ':TSUpdate',
    })
    use('nvim-treesitter/playground')
    use('nvim-treesitter/nvim-treesitter-textobjects')
    -- lsp
    use('neovim/nvim-lspconfig')
    use('tami5/lspsaga.nvim')
    use('ray-x/lsp_signature.nvim')
    -- dap
    use('mfussenegger/nvim-dap')
    use('jbyuki/one-small-step-for-vimkind')
    -- scala lsp
    use('scalameta/nvim-metals')
    -- PlantUML
    use('aklt/plantuml-syntax')
end)
