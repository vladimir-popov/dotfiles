------------------------------------------------------------
-- Plugins
------------------------------------------------------------
vim.cmd([[packadd packer.nvim]])
require('packer').startup(function(use)
    -- packer can manage itself
    use({ 'wbthomason/packer.nvim', opt = true })
    -- colorschemes
    use('Th3Whit3Wolf/one-nvim')
    -- icons with extended symbols
    use('kyazdani42/nvim-web-devicons')
    -- prettyfier a code
    use('sbdchd/neoformat')
    -- autocompletion
    -- Install nvim-cmp, and buffer source as a dependency
    use({
        'hrsh7th/nvim-cmp',
        requires = {
            'hrsh7th/cmp-buffer',
            'hrsh7th/cmp-path',
            'hrsh7th/cmp-nvim-lsp',
            'hrsh7th/cmp-nvim-lsp-signature-help',
            'onsails/lspkind-nvim',
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
            require('utils').nmap('<c-b>', '<cmd>NnnPicker %:p:h<cr>')
            require('utils').nmap('<c-n>', '<cmd>NnnPicker<cr>')
        end,
    })
    -- telescope
    use({
        'nvim-telescope/telescope.nvim',
        requires = { { 'nvim-lua/popup.nvim' }, { 'nvim-lua/plenary.nvim' } },
    })
    -- statusline
    use({
        'dokwork/compline.nvim',
        requires = {
            'kyazdani42/nvim-web-devicons',
            'famiu/feline.nvim',
            -- 'tpope/vim-fugitive',
        },
        config = function()
            require('compline.cosmosline').setup()
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
    -- scala lsp
    use('scalameta/nvim-metals')
    -- PlantUML
    use('aklt/plantuml-syntax')
    -- Colorize (:ColorizerAttachToBuffer)
    use('norcalli/nvim-colorizer.lua')
end)
