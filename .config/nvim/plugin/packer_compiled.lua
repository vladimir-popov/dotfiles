-- Automatically generated packer.nvim plugin loader code

if vim.api.nvim_call_function('has', {'nvim-0.5'}) ~= 1 then
  vim.api.nvim_command('echohl WarningMsg | echom "Invalid Neovim version for packer.nvim! | echohl None"')
  return
end

vim.api.nvim_command('packadd packer.nvim')

local no_errors, error_msg = pcall(function()

_G._packer = _G._packer or {}
_G._packer.inside_compile = true

local time
local profile_info
local should_profile = false
if should_profile then
  local hrtime = vim.loop.hrtime
  profile_info = {}
  time = function(chunk, start)
    if start then
      profile_info[chunk] = hrtime()
    else
      profile_info[chunk] = (hrtime() - profile_info[chunk]) / 1e6
    end
  end
else
  time = function(chunk, start) end
end

local function save_profiles(threshold)
  local sorted_times = {}
  for chunk_name, time_taken in pairs(profile_info) do
    sorted_times[#sorted_times + 1] = {chunk_name, time_taken}
  end
  table.sort(sorted_times, function(a, b) return a[2] > b[2] end)
  local results = {}
  for i, elem in ipairs(sorted_times) do
    if not threshold or threshold and elem[2] > threshold then
      results[i] = elem[1] .. ' took ' .. elem[2] .. 'ms'
    end
  end
  if threshold then
    table.insert(results, '(Only showing plugins that took longer than ' .. threshold .. ' ms ' .. 'to load)')
  end

  _G._packer.profile_output = results
end

time([[Luarocks path setup]], true)
local package_path_str = "/Users/vladimir/.cache/nvim/packer_hererocks/2.1.0-beta3/share/lua/5.1/?.lua;/Users/vladimir/.cache/nvim/packer_hererocks/2.1.0-beta3/share/lua/5.1/?/init.lua;/Users/vladimir/.cache/nvim/packer_hererocks/2.1.0-beta3/lib/luarocks/rocks-5.1/?.lua;/Users/vladimir/.cache/nvim/packer_hererocks/2.1.0-beta3/lib/luarocks/rocks-5.1/?/init.lua"
local install_cpath_pattern = "/Users/vladimir/.cache/nvim/packer_hererocks/2.1.0-beta3/lib/lua/5.1/?.so"
if not string.find(package.path, package_path_str, 1, true) then
  package.path = package.path .. ';' .. package_path_str
end

if not string.find(package.cpath, install_cpath_pattern, 1, true) then
  package.cpath = package.cpath .. ';' .. install_cpath_pattern
end

time([[Luarocks path setup]], false)
time([[try_loadstring definition]], true)
local function try_loadstring(s, component, name)
  local success, result = pcall(loadstring(s), name, _G.packer_plugins[name])
  if not success then
    vim.schedule(function()
      vim.api.nvim_notify('packer.nvim: Error running ' .. component .. ' for ' .. name .. ': ' .. result, vim.log.levels.ERROR, {})
    end)
  end
  return result
end

time([[try_loadstring definition]], false)
time([[Defining packer_plugins]], true)
_G.packer_plugins = {
  LuaSnip = {
    config = { "\27LJ\2\nŠ\1\0\0\4\1\a\0\f6\0\0\0'\2\1\0B\0\2\0029\0\2\0005\2\3\0-\3\0\0=\3\4\2B\0\2\0016\0\5\0'\2\6\0B\0\2\1K\0\1\0\1À Snippets have been updated.\nprint\npaths\1\0\0\tload\29luasnip.loaders.from_lua\frequire>\0\0\3\0\3\0\0066\0\0\0'\2\1\0B\0\2\0029\0\2\0B\0\1\1K\0\1\0\19unlink_current\fluasnip\frequire½\t\1\0\a\0\27\0B6\0\0\0'\2\1\0B\0\2\0029\1\2\0005\3\3\0B\1\2\1'\1\4\0006\2\0\0'\4\5\0B\2\2\0029\2\6\0025\4\a\0=\1\b\4B\2\2\0016\2\t\0009\2\n\0029\2\v\2'\4\f\0'\5\r\0003\6\14\0B\2\4\0016\2\t\0009\2\n\0029\2\v\2'\4\f\0'\5\15\0003\6\16\0B\2\4\0016\2\t\0009\2\17\2'\4\18\0B\2\2\0016\2\t\0009\2\17\2'\4\19\0B\2\2\0016\2\t\0009\2\17\2'\4\20\0B\2\2\0016\2\t\0009\2\17\2'\4\21\0B\2\2\0016\2\t\0009\2\17\2'\4\22\0B\2\2\0016\2\t\0009\2\17\2'\4\23\0B\2\2\0016\2\t\0009\2\17\2'\4\24\0B\2\2\0016\2\t\0009\2\17\2'\4\25\0B\2\2\0016\2\t\0009\2\17\2'\4\26\0B\2\2\0012\0\0€K\0\1\0Ynmap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>'Ysmap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>'Yimap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>'Vnmap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>'Vsmap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>'Vimap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>'Xnmap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>'Xsmap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>'Ximap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>'\bcmd\0\15<leader>ul\0\14<leader>L\6n\bset\vkeymap\bvim\npaths\1\0\0\14lazy_load\29luasnip.loaders.from_lua ~/.config/nvim/lua/snippets\1\0\2\25store_selection_keys\n<Tab>\24enable_autosnippets\2\nsetup\fluasnip\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/LuaSnip",
    url = "https://github.com/L3MON4D3/LuaSnip"
  },
  catppuccin = {
    config = { "\27LJ\2\n…\2\0\0\5\0\16\0\0196\0\0\0009\0\1\0'\1\3\0=\1\2\0006\0\4\0'\2\5\0B\0\2\0029\0\6\0005\2\14\0005\3\b\0005\4\a\0=\4\t\0035\4\n\0=\4\v\0035\4\f\0=\4\r\3=\3\15\2B\0\2\1K\0\1\0\22custom_highlights\1\0\0\22LspReferenceWrite\1\0\1\abg\f#374b7e\21LspReferenceText\1\0\1\abg\f#374b7e\21LspReferenceRead\1\0\0\1\0\1\abg\f#374b7e\nsetup\15catppuccin\frequire\14macchiato\23catppuccin_flavour\6g\bvim\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/catppuccin",
    url = "https://github.com/catppuccin/nvim"
  },
  ["ccc.nvim"] = {
    config = { "\27LJ\2\n1\0\0\3\0\3\0\0066\0\0\0'\2\1\0B\0\2\0029\0\2\0B\0\1\1K\0\1\0\nsetup\bccc\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/ccc.nvim",
    url = "https://github.com/uga-rosa/ccc.nvim"
  },
  ["cmp-buffer"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/cmp-buffer",
    url = "https://github.com/hrsh7th/cmp-buffer"
  },
  ["cmp-nvim-lsp"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/cmp-nvim-lsp",
    url = "https://github.com/hrsh7th/cmp-nvim-lsp"
  },
  ["cmp-nvim-lsp-signature-help"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/cmp-nvim-lsp-signature-help",
    url = "https://github.com/hrsh7th/cmp-nvim-lsp-signature-help"
  },
  ["cmp-path"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/cmp-path",
    url = "https://github.com/hrsh7th/cmp-path"
  },
  cmp_luasnip = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/cmp_luasnip",
    url = "https://github.com/saadparwaiz1/cmp_luasnip"
  },
  ["diffview.nvim"] = {
    config = { "\27LJ\2\n¤\1\0\0\5\0\n\0\r6\0\0\0'\2\1\0B\0\2\0029\0\2\0005\2\6\0005\3\4\0005\4\3\0=\4\5\3=\3\a\0025\3\b\0=\3\t\2B\0\2\1K\0\1\0\15file_panel\1\0\1\18listing_style\ttree\tview\1\0\0\15merge_tool\1\0\0\1\0\1\vlayout\21diff3_horizontal\nsetup\rdiffview\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/diffview.nvim",
    url = "https://github.com/sindrets/diffview.nvim"
  },
  ["gitsigns.nvim"] = {
    config = { "\27LJ\2\nW\0\4\n\1\4\0\14\14\0\3\0X\4\1€4\3\0\0-\4\0\0=\4\0\0036\4\1\0009\4\2\0049\4\3\4\18\6\0\0\18\a\1\0\18\b\2\0\18\t\3\0B\4\5\1K\0\1\0\0À\bset\vkeymap\bvim\vbuffer1\0\0\3\1\2\0\5-\0\0\0009\0\0\0005\2\1\0B\0\2\1K\0\1\0\0\0\1\0\1\tfull\2\15blame_line›\3\1\1\a\1\20\00003\1\0\0\18\2\1\0005\4\1\0'\5\2\0'\6\3\0B\2\4\1\18\2\1\0005\4\4\0'\5\5\0'\6\6\0B\2\4\1\18\2\1\0'\4\a\0'\5\b\0-\6\0\0009\6\t\6B\2\4\1\18\2\1\0'\4\a\0'\5\n\0-\6\0\0009\6\v\6B\2\4\1\18\2\1\0'\4\a\0'\5\f\0-\6\0\0009\6\r\6B\2\4\1\18\2\1\0'\4\a\0'\5\14\0003\6\15\0B\2\4\1\18\2\1\0'\4\a\0'\5\16\0-\6\0\0009\6\17\6B\2\4\1\18\2\1\0'\4\a\0'\5\18\0-\6\0\0009\6\19\6B\2\4\0012\0\0€K\0\1\0\0À\rdiffthis\15<leader>hd\30toggle_current_line_blame\15<leader>tb\0\15<leader>hb\17preview_hunk\15<leader>hp\14next_hunk\a]h\14prev_hunk\a[h\6n\29:Gitsigns reset_hunk<CR>\15<leader>hu\1\3\0\0\6n\6v\29:Gitsigns stage_hunk<CR>\15<leader>hs\1\3\0\0\6n\6v\0T\1\0\5\0\6\0\n6\0\0\0'\2\1\0B\0\2\0029\1\2\0005\3\4\0003\4\3\0=\4\5\3B\1\2\0012\0\0€K\0\1\0\14on_attach\1\0\0\0\nsetup\rgitsigns\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/gitsigns.nvim",
    url = "https://github.com/lewis6991/gitsigns.nvim"
  },
  ["hop.nvim"] = {
    config = { "\27LJ\2\np\0\2\t\0\a\0\f6\2\0\0009\2\1\0029\2\2\2'\4\3\0\18\5\0\0'\6\4\0\18\a\1\0'\b\5\0&\6\b\0065\a\6\0B\2\5\1K\0\1\0\1\0\2\fnoremap\2\vsilent\2\t<cr>\n<cmd>\6n\20nvim_set_keymap\bapi\bvim©\1\1\0\5\0\n\0\0203\0\0\0\18\1\0\0'\3\1\0'\4\2\0B\1\3\1\18\1\0\0'\3\3\0'\4\4\0B\1\3\1\18\1\0\0'\3\5\0'\4\6\0B\1\3\0016\1\a\0'\3\b\0B\1\2\0029\1\t\0014\3\0\0B\1\2\1K\0\1\0\nsetup\bhop\frequire\14HopWordAC\20<space><space>w\14HopWordBC\20<space><space>b\fHopWord\agw\0\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/hop.nvim",
    url = "https://github.com/phaazon/hop.nvim"
  },
  ["indent-blankline.nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/indent-blankline.nvim",
    url = "https://github.com/lukas-reineke/indent-blankline.nvim"
  },
  ["lazygit.nvim"] = {
    config = { "\27LJ\2\n´\1\0\0\6\0\t\0\0176\0\0\0009\0\1\0009\0\2\0'\2\3\0'\3\4\0'\4\5\0005\5\6\0B\0\5\0016\0\0\0009\0\1\0009\0\2\0'\2\3\0'\3\a\0'\4\5\0005\5\b\0B\0\5\1K\0\1\0\1\0\2\fnoremap\2\vsilent\2\15<leader>lg\1\0\2\fnoremap\2\vsilent\2\21<cmd>LazyGit<cr>\15<leader>gs\6n\20nvim_set_keymap\bapi\bvim\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lazygit.nvim",
    url = "https://github.com/kdheepak/lazygit.nvim"
  },
  ["lsp_signature.nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lsp_signature.nvim",
    url = "https://github.com/ray-x/lsp_signature.nvim"
  },
  ["lspkind-nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lspkind-nvim",
    url = "https://github.com/onsails/lspkind-nvim"
  },
  ["lspsaga.nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lspsaga.nvim",
    url = "https://github.com/tami5/lspsaga.nvim"
  },
  ["lualine-ex"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lualine-ex",
    url = "https://github.com/vladimir-popov/lualine-ex"
  },
  ["lualine-lsp-progress"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lualine-lsp-progress",
    url = "https://github.com/arkav/lualine-lsp-progress"
  },
  ["lualine.nvim"] = {
    config = { "\27LJ\2\nT\0\0\5\0\4\0\t6\0\0\0'\2\1\0B\0\2\0029\0\2\0006\2\0\0'\4\3\0B\2\2\0A\0\0\1K\0\1\0\23lualine.cosmosline\nsetup\flualine\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/lualine.nvim",
    url = "https://github.com/nvim-lualine/lualine.nvim"
  },
  ["neo-tree.nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/neo-tree.nvim",
    url = "https://github.com/nvim-neo-tree/neo-tree.nvim"
  },
  neoformat = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/neoformat",
    url = "https://github.com/sbdchd/neoformat"
  },
  ["nnn.vim"] = {
    config = { "\27LJ\2\n¶\1\0\0\4\0\v\0\0196\0\0\0009\0\1\0'\1\3\0=\1\2\0006\0\4\0'\2\5\0B\0\2\0029\0\6\0'\2\a\0'\3\b\0B\0\3\0016\0\4\0'\2\5\0B\0\2\0029\0\6\0'\2\t\0'\3\n\0B\0\3\1K\0\1\0\29<cmd>NnnPicker %:p:h<cr>\n<c-b>\23<cmd>NnnPicker<cr>\n<c-n>\tnmap\nutils\frequire\nlocal\16nnn#session\6g\bvim\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nnn.vim",
    url = "https://github.com/mcchrish/nnn.vim"
  },
  ["nui.nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nui.nvim",
    url = "https://github.com/MunifTanjim/nui.nvim"
  },
  ["nvim-autopairs"] = {
    config = { "\27LJ\2\nM\0\0\3\0\4\0\a6\0\0\0'\2\1\0B\0\2\0029\0\2\0005\2\3\0B\0\2\1K\0\1\0\1\0\1\rcheck_ts\2\nsetup\19nvim-autopairs\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-autopairs",
    url = "https://github.com/windwp/nvim-autopairs"
  },
  ["nvim-bqf"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-bqf",
    url = "https://github.com/kevinhwang91/nvim-bqf"
  },
  ["nvim-cmp"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-cmp",
    url = "https://github.com/hrsh7th/nvim-cmp"
  },
  ["nvim-dap"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-dap",
    url = "https://github.com/mfussenegger/nvim-dap"
  },
  ["nvim-lspconfig"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-lspconfig",
    url = "https://github.com/neovim/nvim-lspconfig"
  },
  ["nvim-metals"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-metals",
    url = "https://github.com/scalameta/nvim-metals"
  },
  ["nvim-tree.lua"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-tree.lua",
    url = "https://github.com/kyazdani42/nvim-tree.lua"
  },
  ["nvim-treesitter"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-treesitter",
    url = "https://github.com/nvim-treesitter/nvim-treesitter"
  },
  ["nvim-treesitter-textobjects"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-treesitter-textobjects",
    url = "https://github.com/nvim-treesitter/nvim-treesitter-textobjects"
  },
  ["nvim-web-devicons"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/nvim-web-devicons",
    url = "https://github.com/kyazdani42/nvim-web-devicons"
  },
  ["one-nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/one-nvim",
    url = "https://github.com/Th3Whit3Wolf/one-nvim"
  },
  ["one-small-step-for-vimkind"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/one-small-step-for-vimkind",
    url = "https://github.com/jbyuki/one-small-step-for-vimkind"
  },
  ["packer.nvim"] = {
    loaded = false,
    needs_bufread = false,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/opt/packer.nvim",
    url = "https://github.com/wbthomason/packer.nvim"
  },
  ["plantuml-syntax"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/plantuml-syntax",
    url = "https://github.com/aklt/plantuml-syntax"
  },
  playground = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/playground",
    url = "https://github.com/nvim-treesitter/playground"
  },
  ["plenary.nvim"] = {
    config = { "\27LJ\2\ne\0\0\6\0\6\0\t6\0\0\0009\0\1\0009\0\2\0'\2\3\0'\3\4\0'\4\5\0004\5\0\0B\0\5\1K\0\1\0\30<Plug>PlenaryTestFile<cr>\n<F17>\6n\20nvim_set_keymap\bapi\bvim\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/plenary.nvim",
    url = "https://github.com/nvim-lua/plenary.nvim"
  },
  ["telescope.nvim"] = {
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/telescope.nvim",
    url = "https://github.com/nvim-telescope/telescope.nvim"
  },
  ["trouble.nvim"] = {
    config = { "\27LJ\2\n9\0\0\3\0\3\0\a6\0\0\0'\2\1\0B\0\2\0029\0\2\0004\2\0\0B\0\2\1K\0\1\0\nsetup\ftrouble\frequire\0" },
    loaded = true,
    path = "/Users/vladimir/.local/share/nvim/site/pack/packer/start/trouble.nvim",
    url = "https://github.com/folke/trouble.nvim"
  }
}

time([[Defining packer_plugins]], false)
-- Config for: nvim-autopairs
time([[Config for nvim-autopairs]], true)
try_loadstring("\27LJ\2\nM\0\0\3\0\4\0\a6\0\0\0'\2\1\0B\0\2\0029\0\2\0005\2\3\0B\0\2\1K\0\1\0\1\0\1\rcheck_ts\2\nsetup\19nvim-autopairs\frequire\0", "config", "nvim-autopairs")
time([[Config for nvim-autopairs]], false)
-- Config for: LuaSnip
time([[Config for LuaSnip]], true)
try_loadstring("\27LJ\2\nŠ\1\0\0\4\1\a\0\f6\0\0\0'\2\1\0B\0\2\0029\0\2\0005\2\3\0-\3\0\0=\3\4\2B\0\2\0016\0\5\0'\2\6\0B\0\2\1K\0\1\0\1À Snippets have been updated.\nprint\npaths\1\0\0\tload\29luasnip.loaders.from_lua\frequire>\0\0\3\0\3\0\0066\0\0\0'\2\1\0B\0\2\0029\0\2\0B\0\1\1K\0\1\0\19unlink_current\fluasnip\frequire½\t\1\0\a\0\27\0B6\0\0\0'\2\1\0B\0\2\0029\1\2\0005\3\3\0B\1\2\1'\1\4\0006\2\0\0'\4\5\0B\2\2\0029\2\6\0025\4\a\0=\1\b\4B\2\2\0016\2\t\0009\2\n\0029\2\v\2'\4\f\0'\5\r\0003\6\14\0B\2\4\0016\2\t\0009\2\n\0029\2\v\2'\4\f\0'\5\15\0003\6\16\0B\2\4\0016\2\t\0009\2\17\2'\4\18\0B\2\2\0016\2\t\0009\2\17\2'\4\19\0B\2\2\0016\2\t\0009\2\17\2'\4\20\0B\2\2\0016\2\t\0009\2\17\2'\4\21\0B\2\2\0016\2\t\0009\2\17\2'\4\22\0B\2\2\0016\2\t\0009\2\17\2'\4\23\0B\2\2\0016\2\t\0009\2\17\2'\4\24\0B\2\2\0016\2\t\0009\2\17\2'\4\25\0B\2\2\0016\2\t\0009\2\17\2'\4\26\0B\2\2\0012\0\0€K\0\1\0Ynmap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>'Ysmap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>'Yimap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>'Vnmap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>'Vsmap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>'Vimap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>'Xnmap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>'Xsmap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>'Ximap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>'\bcmd\0\15<leader>ul\0\14<leader>L\6n\bset\vkeymap\bvim\npaths\1\0\0\14lazy_load\29luasnip.loaders.from_lua ~/.config/nvim/lua/snippets\1\0\2\25store_selection_keys\n<Tab>\24enable_autosnippets\2\nsetup\fluasnip\frequire\0", "config", "LuaSnip")
time([[Config for LuaSnip]], false)
-- Config for: plenary.nvim
time([[Config for plenary.nvim]], true)
try_loadstring("\27LJ\2\ne\0\0\6\0\6\0\t6\0\0\0009\0\1\0009\0\2\0'\2\3\0'\3\4\0'\4\5\0004\5\0\0B\0\5\1K\0\1\0\30<Plug>PlenaryTestFile<cr>\n<F17>\6n\20nvim_set_keymap\bapi\bvim\0", "config", "plenary.nvim")
time([[Config for plenary.nvim]], false)
-- Config for: hop.nvim
time([[Config for hop.nvim]], true)
try_loadstring("\27LJ\2\np\0\2\t\0\a\0\f6\2\0\0009\2\1\0029\2\2\2'\4\3\0\18\5\0\0'\6\4\0\18\a\1\0'\b\5\0&\6\b\0065\a\6\0B\2\5\1K\0\1\0\1\0\2\fnoremap\2\vsilent\2\t<cr>\n<cmd>\6n\20nvim_set_keymap\bapi\bvim©\1\1\0\5\0\n\0\0203\0\0\0\18\1\0\0'\3\1\0'\4\2\0B\1\3\1\18\1\0\0'\3\3\0'\4\4\0B\1\3\1\18\1\0\0'\3\5\0'\4\6\0B\1\3\0016\1\a\0'\3\b\0B\1\2\0029\1\t\0014\3\0\0B\1\2\1K\0\1\0\nsetup\bhop\frequire\14HopWordAC\20<space><space>w\14HopWordBC\20<space><space>b\fHopWord\agw\0\0", "config", "hop.nvim")
time([[Config for hop.nvim]], false)
-- Config for: nnn.vim
time([[Config for nnn.vim]], true)
try_loadstring("\27LJ\2\n¶\1\0\0\4\0\v\0\0196\0\0\0009\0\1\0'\1\3\0=\1\2\0006\0\4\0'\2\5\0B\0\2\0029\0\6\0'\2\a\0'\3\b\0B\0\3\0016\0\4\0'\2\5\0B\0\2\0029\0\6\0'\2\t\0'\3\n\0B\0\3\1K\0\1\0\29<cmd>NnnPicker %:p:h<cr>\n<c-b>\23<cmd>NnnPicker<cr>\n<c-n>\tnmap\nutils\frequire\nlocal\16nnn#session\6g\bvim\0", "config", "nnn.vim")
time([[Config for nnn.vim]], false)
-- Config for: ccc.nvim
time([[Config for ccc.nvim]], true)
try_loadstring("\27LJ\2\n1\0\0\3\0\3\0\0066\0\0\0'\2\1\0B\0\2\0029\0\2\0B\0\1\1K\0\1\0\nsetup\bccc\frequire\0", "config", "ccc.nvim")
time([[Config for ccc.nvim]], false)
-- Config for: trouble.nvim
time([[Config for trouble.nvim]], true)
try_loadstring("\27LJ\2\n9\0\0\3\0\3\0\a6\0\0\0'\2\1\0B\0\2\0029\0\2\0004\2\0\0B\0\2\1K\0\1\0\nsetup\ftrouble\frequire\0", "config", "trouble.nvim")
time([[Config for trouble.nvim]], false)
-- Config for: gitsigns.nvim
time([[Config for gitsigns.nvim]], true)
try_loadstring("\27LJ\2\nW\0\4\n\1\4\0\14\14\0\3\0X\4\1€4\3\0\0-\4\0\0=\4\0\0036\4\1\0009\4\2\0049\4\3\4\18\6\0\0\18\a\1\0\18\b\2\0\18\t\3\0B\4\5\1K\0\1\0\0À\bset\vkeymap\bvim\vbuffer1\0\0\3\1\2\0\5-\0\0\0009\0\0\0005\2\1\0B\0\2\1K\0\1\0\0\0\1\0\1\tfull\2\15blame_line›\3\1\1\a\1\20\00003\1\0\0\18\2\1\0005\4\1\0'\5\2\0'\6\3\0B\2\4\1\18\2\1\0005\4\4\0'\5\5\0'\6\6\0B\2\4\1\18\2\1\0'\4\a\0'\5\b\0-\6\0\0009\6\t\6B\2\4\1\18\2\1\0'\4\a\0'\5\n\0-\6\0\0009\6\v\6B\2\4\1\18\2\1\0'\4\a\0'\5\f\0-\6\0\0009\6\r\6B\2\4\1\18\2\1\0'\4\a\0'\5\14\0003\6\15\0B\2\4\1\18\2\1\0'\4\a\0'\5\16\0-\6\0\0009\6\17\6B\2\4\1\18\2\1\0'\4\a\0'\5\18\0-\6\0\0009\6\19\6B\2\4\0012\0\0€K\0\1\0\0À\rdiffthis\15<leader>hd\30toggle_current_line_blame\15<leader>tb\0\15<leader>hb\17preview_hunk\15<leader>hp\14next_hunk\a]h\14prev_hunk\a[h\6n\29:Gitsigns reset_hunk<CR>\15<leader>hu\1\3\0\0\6n\6v\29:Gitsigns stage_hunk<CR>\15<leader>hs\1\3\0\0\6n\6v\0T\1\0\5\0\6\0\n6\0\0\0'\2\1\0B\0\2\0029\1\2\0005\3\4\0003\4\3\0=\4\5\3B\1\2\0012\0\0€K\0\1\0\14on_attach\1\0\0\0\nsetup\rgitsigns\frequire\0", "config", "gitsigns.nvim")
time([[Config for gitsigns.nvim]], false)
-- Config for: lazygit.nvim
time([[Config for lazygit.nvim]], true)
try_loadstring("\27LJ\2\n´\1\0\0\6\0\t\0\0176\0\0\0009\0\1\0009\0\2\0'\2\3\0'\3\4\0'\4\5\0005\5\6\0B\0\5\0016\0\0\0009\0\1\0009\0\2\0'\2\3\0'\3\a\0'\4\5\0005\5\b\0B\0\5\1K\0\1\0\1\0\2\fnoremap\2\vsilent\2\15<leader>lg\1\0\2\fnoremap\2\vsilent\2\21<cmd>LazyGit<cr>\15<leader>gs\6n\20nvim_set_keymap\bapi\bvim\0", "config", "lazygit.nvim")
time([[Config for lazygit.nvim]], false)
-- Config for: diffview.nvim
time([[Config for diffview.nvim]], true)
try_loadstring("\27LJ\2\n¤\1\0\0\5\0\n\0\r6\0\0\0'\2\1\0B\0\2\0029\0\2\0005\2\6\0005\3\4\0005\4\3\0=\4\5\3=\3\a\0025\3\b\0=\3\t\2B\0\2\1K\0\1\0\15file_panel\1\0\1\18listing_style\ttree\tview\1\0\0\15merge_tool\1\0\0\1\0\1\vlayout\21diff3_horizontal\nsetup\rdiffview\frequire\0", "config", "diffview.nvim")
time([[Config for diffview.nvim]], false)
-- Config for: catppuccin
time([[Config for catppuccin]], true)
try_loadstring("\27LJ\2\n…\2\0\0\5\0\16\0\0196\0\0\0009\0\1\0'\1\3\0=\1\2\0006\0\4\0'\2\5\0B\0\2\0029\0\6\0005\2\14\0005\3\b\0005\4\a\0=\4\t\0035\4\n\0=\4\v\0035\4\f\0=\4\r\3=\3\15\2B\0\2\1K\0\1\0\22custom_highlights\1\0\0\22LspReferenceWrite\1\0\1\abg\f#374b7e\21LspReferenceText\1\0\1\abg\f#374b7e\21LspReferenceRead\1\0\0\1\0\1\abg\f#374b7e\nsetup\15catppuccin\frequire\14macchiato\23catppuccin_flavour\6g\bvim\0", "config", "catppuccin")
time([[Config for catppuccin]], false)
-- Config for: lualine.nvim
time([[Config for lualine.nvim]], true)
try_loadstring("\27LJ\2\nT\0\0\5\0\4\0\t6\0\0\0'\2\1\0B\0\2\0029\0\2\0006\2\0\0'\4\3\0B\2\2\0A\0\0\1K\0\1\0\23lualine.cosmosline\nsetup\flualine\frequire\0", "config", "lualine.nvim")
time([[Config for lualine.nvim]], false)

_G._packer.inside_compile = false
if _G._packer.needs_bufread == true then
  vim.cmd("doautocmd BufRead")
end
_G._packer.needs_bufread = false

if should_profile then save_profiles() end

end)

if not no_errors then
  error_msg = error_msg:gsub('"', '\\"')
  vim.api.nvim_command('echohl ErrorMsg | echom "Error in packer_compiled: '..error_msg..'" | echom "Please check your config for correctness" | echohl None')
end
