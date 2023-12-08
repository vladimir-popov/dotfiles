local forc = s(
    'forc',
    fmta(
        [[for {
  _ <<- <>
} yield ???]],
        { i(1) }
    )
)

local cats = s('cats', t('import cats.implicits._'))

local asScala = s('asscala', t('import scala.jdk.CollectionConverters._'))

local scalatest_freespec = s(
    'scalatestfreespec',
    fmta(
        [[import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class <>Test extends AnyFreeSpec with Matchers {
    <>
}
]],
        {
            f(function()
                local name = string.gsub(vim.fn.expand('%:t'), '(%w+).test.scala', '%1')
                return name
            end),
            i(0),
        }
    )
)

local snippets = {
    cats,
    asScala,
    scalatest_freespec,
    forc,
}
local autosnippets = {}

return snippets, autosnippets
