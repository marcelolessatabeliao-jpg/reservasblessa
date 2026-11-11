const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normalizeArrayResponse = (json: any): {
  items: any[]
  currentPage: number
  lastPage: number
  perPage: number
  total: number
} => {
  if (Array.isArray(json)) {
    return {
      items: json,
      currentPage: 1,
      lastPage: 1,
      perPage: json.length,
      total: json.length,
    }
  }
  if (json && Array.isArray(json.data)) {
    return {
      items: json.data,
      currentPage: Number(json.current_page || 1),
      lastPage: Number(json.last_page || 1),
      perPage: Number(json.per_page || json.data.length || 100),
      total: Number(json.total || json.data.length),
    }
  }
  if (json?.clientes && Array.isArray(json.clientes)) {
    return {
      items: json.clientes,
      currentPage: 1,
      lastPage: 1,
      perPage: json.clientes.length,
      total: json.clientes.length,
    }
  }
  return {
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 0,
    total: 0,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'init')

    const BASE_URL = (Deno.env.get('LABCARD_API_URL') || 'https://api.cartaobl.com.br').replace(/\/+$/, '')
    const ENV_USER = (Deno.env.get('LABCARD_API_USER') || '').trim()
    const ENV_PASS = (Deno.env.get('LABCARD_API_PASSWORD') || '').trim()

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          hasServerCredentials: Boolean(ENV_USER && ENV_PASS),
          baseUrl: BASE_URL,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const resolveToken = async (): Promise<string> => {
      const providedToken = String(body.token || '').trim()
      if (providedToken) return providedToken

      const usuario = String(body.usuario || ENV_USER || '').trim()
      const senha = String(body.senha || ENV_PASS || '').trim()
      if (!usuario || !senha) {
        throw new Error(
          'Credenciais da API do Labcard não configuradas. Informe usuário e senha de administrador do Labcard para autenticar.'
        )
      }

      const loginRes = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          usuario_view: usuario,
          senha_view: senha,
        }),
      })

      const loginText = await loginRes.text()
      let loginJson: any = {}
      try {
        loginJson = JSON.parse(loginText)
      } catch {
        loginJson = { raw: loginText }
      }

      if (!loginRes.ok) {
        const rawErr = String(
          loginJson?.message || loginJson?.error || loginText || loginRes.statusText || ''
        )
        if (/SQLSTATE\[HY000\].*1045|Access denied for user/i.test(rawErr)) {
          throw new Error(
            `O servidor da API do Labcard (api.cartaobl.com.br) retornou HTTP ${loginRes.status} por falha de acesso ao banco MySQL deles ("Access denied for user u379359386_cartaoBlSystem"). Esse erro é no servidor da Labcard/Cartaobl e precisa ser corrigido pelo suporte/hospedagem deles.`
          )
        }
        throw new Error(
          `Falha ao autenticar na API do Labcard (HTTP ${loginRes.status}): ${rawErr.slice(0, 260)}`
        )
      }

      const token =
        loginJson?.token ||
        loginJson?.access_token ||
        loginJson?.jwt ||
        loginJson?.authorization ||
        loginJson?.data?.token ||
        loginJson?.data?.access_token

      if (!token || typeof token !== 'string') {
        throw new Error(
          `Login realizado, mas nenhum token JWT foi reconhecido na resposta (${Object.keys(loginJson || {}).join(', ')}).`
        )
      }
      return token
    }

    const fetchLabcardJson = async (path: string, token: string) => {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
      const text = await res.text()
      let json: any = {}
      try {
        json = JSON.parse(text)
      } catch {
        json = { raw: text }
      }
      if (!res.ok) {
        throw new Error(
          `Labcard API (${path} -> ${res.status}): ${json?.message || json?.error || res.statusText}`
        )
      }
      return json
    }

    if (action === 'init') {
      const token = await resolveToken()

      const [clientesPage1Raw, consultoresRaw, empresasRaw, planosRaw] = await Promise.all([
        fetchLabcardJson('/api/clientes?page=1', token),
        fetchLabcardJson('/api/consultores', token).catch(() => []),
        fetchLabcardJson('/api/empresas', token).catch(() => []),
        fetchLabcardJson('/api/planos', token).catch(() => []),
      ])

      const clientesPage1 = normalizeArrayResponse(clientesPage1Raw)
      const consultores = normalizeArrayResponse(consultoresRaw).items
      const empresas = normalizeArrayResponse(empresasRaw).items
      const planos = normalizeArrayResponse(planosRaw).items

      const sampleKeys =
        clientesPage1.items.length > 0 && typeof clientesPage1.items[0] === 'object'
          ? Object.keys(clientesPage1.items[0])
          : []

      return new Response(
        JSON.stringify({
          token,
          hasServerCredentials: Boolean(ENV_USER && ENV_PASS),
          currentPage: clientesPage1.currentPage,
          lastPage: clientesPage1.lastPage,
          perPage: clientesPage1.perPage,
          totalClientes: clientesPage1.total,
          clientes: clientesPage1.items,
          consultores,
          empresas,
          planos,
          sampleKeys,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (action === 'fetch-clientes-pages') {
      const token = await resolveToken()
      const startPage = Math.max(1, Number(body.startPage || 1))
      const endPage = Math.max(startPage, Number(body.endPage || startPage))

      const pageNums: number[] = []
      for (let p = startPage; p <= endPage; p += 1) {
        pageNums.push(p)
      }

      const allItems: any[] = []
      let lastPage = endPage
      let totalClientes = 0

      // Busca em lotes de 4 páginas simultâneas para manter baixa latência sem sobrecarregar a API
      const chunkSize = 4
      for (let i = 0; i < pageNums.length; i += chunkSize) {
        const slice = pageNums.slice(i, i + chunkSize)
        const results = await Promise.all(
          slice.map(async (pageNum) => {
            const raw = await fetchLabcardJson(`/api/clientes?page=${pageNum}`, token)
            return normalizeArrayResponse(raw)
          })
        )
        for (const r of results) {
          allItems.push(...r.items)
          if (r.lastPage > 0) lastPage = r.lastPage
          if (r.total > 0) totalClientes = r.total
        }
      }

      return new Response(
        JSON.stringify({
          items: allItems,
          startPage,
          endPage,
          lastPage,
          totalClientes,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (action === 'fetch-boletos') {
      const token = await resolveToken()
      const cardNumber = String(body.numCard || '').trim()
      if (cardNumber) {
        const raw = await fetchLabcardJson(`/api/boletos/${encodeURIComponent(cardNumber)}`, token).catch(() => [])
        const norm = normalizeArrayResponse(raw)
        return new Response(
          JSON.stringify({ boletos: norm.items, lastPage: 1, total: norm.items.length }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      const startPage = Math.max(1, Number(body.startPage || 1))
      const maxPages = Math.min(20, Math.max(1, Number(body.maxPages || 10)))
      const page1Raw = await fetchLabcardJson(`/api/boletos?page=${startPage}`, token).catch(() => [])
      const page1 = normalizeArrayResponse(page1Raw)
      const allBoletos = [...page1.items]
      const targetLast = Math.min(page1.lastPage || 1, startPage + maxPages - 1)

      if (targetLast > startPage) {
        const restPages: number[] = []
        for (let p = startPage + 1; p <= targetLast; p += 1) restPages.push(p)
        const chunkSize = 4
        for (let i = 0; i < restPages.length; i += chunkSize) {
          const slice = restPages.slice(i, i + chunkSize)
          const resList = await Promise.all(
            slice.map((p) =>
              fetchLabcardJson(`/api/boletos?page=${p}`, token)
                .then(normalizeArrayResponse)
                .catch(() => ({ items: [], currentPage: p, lastPage: page1.lastPage, perPage: 0, total: 0 }))
            )
          )
          resList.forEach((r) => allBoletos.push(...r.items))
        }
      }

      return new Response(
        JSON.stringify({
          boletos: allBoletos,
          lastPage: page1.lastPage,
          total: page1.total || allBoletos.length,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    throw new Error(`Ação inválida para sync-labcard: ${action}`)
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || 'Erro desconhecido na integração Labcard',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})
