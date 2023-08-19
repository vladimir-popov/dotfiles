local colors = {
	fg = "#abb2bf",
	bg = "#3c3c41",
	alpha = "NONE",
	inactive = "#5c6370",
	insert = "#79a15c",
	command = "#e5c07b",
	visual = "#c678dd",
	normal = "#61afef",
	replace = "#d3869b",
}

local cosmos_theme = {
	normal = {
		a = { bg = colors.bg, fg = colors.normal },
		b = { bg = colors.bg, fg = colors.fg },
		c = { bg = colors.alpha, fg = colors.inactive },

		x = { bg = colors.alpha, fg = "green" },
		y = { bg = colors.bg, fg = colors.fg },
		z = { bg = colors.bg, fg = colors.normal },
	},
	insert = {
		a = { bg = colors.bg, fg = colors.insert },
		b = { bg = colors.bg, fg = colors.fg },
		c = { bg = colors.alpha, fg = colors.inactive },

		x = { bg = colors.alpha, fg = colors.inactive },
		y = { bg = colors.bg, fg = colors.fg },
		z = { bg = colors.bg, fg = colors.insert },
	},
	visual = {
		a = { bg = colors.bg, fg = colors.visual },
		b = { bg = colors.bg, fg = colors.fg },
		c = { bg = colors.alpha, fg = colors.inactive },

		x = { bg = colors.alpha, fg = colors.inactive },
		y = { bg = colors.bg, fg = colors.fg },
		z = { bg = colors.bg, fg = colors.visual },
	},
	replace = {
		a = { bg = colors.bg, fg = colors.replace },
		b = { bg = colors.bg, fg = colors.fg },
		c = { bg = colors.alpha, fg = colors.inactive },

		x = { bg = colors.alpha, fg = colors.inactive },
		y = { bg = colors.bg, fg = colors.fg },
		z = { bg = colors.bg, fg = colors.replace },
	},
	command = {
		a = { bg = colors.bg, fg = colors.command },
		b = { bg = colors.bg, fg = colors.fg },
		c = { bg = colors.alpha, fg = colors.inactive },

		x = { bg = colors.alpha, fg = colors.inactive },
		y = { bg = colors.bg, fg = colors.fg },
		z = { bg = colors.bg, fg = colors.command },
	},
	inactive = {
		a = { bg = colors.bg, fg = colors.inactive },
		b = { bg = colors.bg, fg = colors.fg },
		c = { bg = colors.alpha, fg = colors.inactive },

		x = { bg = colors.alpha, fg = colors.inactive },
		y = { bg = colors.bg, fg = colors.fg },
		z = { bg = colors.bg, fg = colors.inactive },
	},
}

local function toggle_spell()
	vim.o.spell = not vim.o.spell
end

return {
	"nvim-lualine/lualine.nvim",
	lazy = false,
	dependencies = {
		"nvim-tree/nvim-web-devicons",
		"dokwork/lualine-ex",
		"arkav/lualine-lsp-progress",
		"nvim-lua/plenary.nvim",
	},
	opts = {
		options = {
			always_divide_middle = true,
			globalstatus = true,
			component_separators = {
				left = "%#lualine_a_normal#|",
				right = "%#lualine_a_normal#|",
			},
			section_separators = { left = " ", right = " " },
			theme = cosmos_theme,
		},
		sections = {
			lualine_a = {
				{ '%{"▊"}', separator = "", padding = 0 },
				{ "ex.cwd", padding = 0 },
			},
			lualine_b = {
				{ "ex.relative_filename", padding = 0 },
			},
			lualine_c = { "lsp_progress" },

			lualine_x = { "ex.git.branch" },
			lualine_y = {
				"diagnostics",
				{ "ex.lsp.all", icons_only = true, on_click = toggle_spell },
				"fileformat",
				"encoding",
				{ "filetype", icons_enabled = false },
			},
			lualine_z = {
				"progress",
			},
		},
		inactive_sections = {
			lualine_a = { "mode" },
			lualine_b = { "filename" },
		},
		winbar = {
			lualine_a = {
				"filename",
			},
			lualine_y = {
				{ "ex.spellcheck", on_click = toggle_spell },
				"location",
			},
		},
		inactive_winbar = {
			lualine_c = {
				"filename",
			},
		},
	},
}
