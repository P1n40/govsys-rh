import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const ALLOWED_ROLES = ['ADMIN', 'GERENTE', 'COORDENADOR', 'SUPERVISOR', 'ANALISTA', 'AUXILIAR_ADMINISTRATIVO', 'JOVEM_APRENDIZ'] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

type CreateUsuarioBody = {
  nome?: string
  role?: string
  setor?: string | null
  email?: string
  password?: string
}

function pickRole(input: string | undefined): AllowedRole {
  const role = String(input ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (role === 'RESPONSIBLE') return 'ANALISTA'
  if (role === 'SUBSTITUTE' || role === 'ATTENDANT') return 'AUXILIAR_ADMINISTRATIVO'
  if (role === 'APRENDIZ') return 'JOVEM_APRENDIZ'

  if (ALLOWED_ROLES.includes(role as AllowedRole)) {
    return role as AllowedRole
  }
  return 'ANALISTA'
}

function compact(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateUsuarioBody
    const nome = String(body.nome ?? '').trim()
    const role = pickRole(body.role)
    const setor = body.setor ? String(body.setor) : null
    const email = body.email ? String(body.email).trim().toLowerCase() : ''
    const password = body.password ? String(body.password) : ''

    if (!nome) {
      return NextResponse.json({ error: 'Nome obrigatorio.' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    let authUserId: string | undefined
    if (email || password) {
      if (!email || !password) {
        return NextResponse.json({ error: 'Informe email e senha para criar login.' }, { status: 400 })
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      authUserId = authData.user?.id
    }

    const userId = authUserId ?? crypto.randomUUID()
    const baseWithId = { id: userId, nome }
    const baseWithoutId = { nome }
    const candidates = [
      compact({ ...baseWithId }),
      compact({ ...baseWithoutId }),
      compact({ ...baseWithId, role }),
      compact({ ...baseWithoutId, role }),
      compact({ ...baseWithId, perfil: role }),
      compact({ ...baseWithoutId, perfil: role }),
      compact({ ...baseWithId, papel: role }),
      compact({ ...baseWithoutId, papel: role }),
      compact({ ...baseWithId, cargo: role }),
      compact({ ...baseWithoutId, cargo: role }),
      compact({ ...baseWithId, tipo: role }),
      compact({ ...baseWithoutId, tipo: role }),
      compact({ ...baseWithId, nivel: role }),
      compact({ ...baseWithoutId, nivel: role }),
      compact({ ...baseWithId, permissao: role }),
      compact({ ...baseWithoutId, permissao: role }),
      compact({ ...baseWithId, acesso: role }),
      compact({ ...baseWithoutId, acesso: role }),
      compact({ ...baseWithId, setor: setor ?? undefined }),
      compact({ ...baseWithoutId, setor: setor ?? undefined }),
      compact({ ...baseWithId, sector: setor ?? undefined }),
      compact({ ...baseWithoutId, sector: setor ?? undefined }),
      compact({ ...baseWithId, departamento: setor ?? undefined }),
      compact({ ...baseWithoutId, departamento: setor ?? undefined }),
      compact({ ...baseWithId, email: email || undefined }),
      compact({ ...baseWithoutId, email: email || undefined }),
    ]

    const errors: string[] = []

    for (const payload of candidates) {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .insert(payload)
        .select('*')
        .single()

      if (!error && data) {
        const mutableRoleFields = ['role', 'perfil', 'papel', 'cargo', 'tipo', 'nivel', 'permissao', 'acesso']
        const mutableSetorFields = ['setor', 'sector', 'departamento']

        for (const field of mutableRoleFields) {
          if (field in data) {
            await supabaseAdmin.from('usuarios').update({ [field]: role }).eq('id', data.id)
            break
          }
        }

        if (setor) {
          for (const field of mutableSetorFields) {
            if (field in data) {
              await supabaseAdmin.from('usuarios').update({ [field]: setor }).eq('id', data.id)
              break
            }
          }
        }

        if (email && 'email' in data) {
          await supabaseAdmin.from('usuarios').update({ email }).eq('id', data.id)
        }

        const { data: latest } = await supabaseAdmin.from('usuarios').select('*').eq('id', data.id).maybeSingle()
        const user = (latest ?? data) as Record<string, unknown>

        return NextResponse.json({
          user: {
            id: String(user.id),
            nome: String(user.nome ?? nome),
            role: String(user.role ?? user.perfil ?? user.papel ?? user.cargo ?? user.tipo ?? user.nivel ?? user.permissao ?? user.acesso ?? role).toUpperCase(),
            setor: ((user.setor ?? user.sector ?? user.departamento ?? setor) as string | null | undefined) ?? null,
            email: ((user.email as string | undefined) ?? (email || null)),
          },
        })
      }

      if (error) errors.push(error.message)
    }

    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    }

    return NextResponse.json(
      { error: `Nao foi possivel criar usuario na tabela usuarios. Detalhes: ${errors.join(' | ')}` },
      { status: 500 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao criar usuario.' },
      { status: 500 }
    )
  }
}
