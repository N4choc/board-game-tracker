import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  boardGroups,
  boardPlayers,
  boardGroupPlayers,
  boardGames,
  boardGroupGames,
  boardMatches,
  boardMatchPlayers,
} from '@/lib/db/schema'
import { eq, and, or, sql, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET() {
  try {
    const [groups, players, groupPlayers, games, groupGames, matches, matchPlayers] = await Promise.all([
      db.select().from(boardGroups),
      db.select().from(boardPlayers),
      db.select().from(boardGroupPlayers),
      db.select().from(boardGames),
      db.select().from(boardGroupGames),
      db.select().from(boardMatches),
      db.select().from(boardMatchPlayers),
    ])

    // Ensure all groups have an invite_code in parallel if any are missing
    const missingInvite = groups.filter((g) => !g.inviteCode)
    if (missingInvite.length > 0) {
      await Promise.all(
        missingInvite.map(async (g) => {
          const code = Math.random().toString(36).slice(2, 10)
          await db.update(boardGroups).set({ inviteCode: code }).where(eq(boardGroups.id, g.id))
          g.inviteCode = code
        })
      )
    }

    return NextResponse.json(
      { groups, players, groupPlayers, games, groupGames, matches, matchPlayers },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    )
  } catch (err: any) {
    console.error('[API /api/board GET error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Error al obtener datos de la base de datos' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'No autorizado. Iniciá sesión para guardar cambios.' }, { status: 401 })
    const body = await request.json()
    const id = String(body.id || '')
    if (!id || !['group', 'player', 'game', 'match'].includes(body.type)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    if (body.type === 'group') {
      const inviteCode = body.group.inviteCode || Math.random().toString(36).slice(2, 10)
      const rawPlayers: any[] = body.players ?? []

      await db.transaction(async (tx) => {
        await tx.insert(boardGroups).values({
          ...body.group,
          createdBy: session.user.id,
          inviteCode,
        })

        if (rawPlayers.length > 0) {
          const playersToInsert = rawPlayers.map((player) => ({
            ...player,
            userId:
              player.userId ||
              (player.name.toLowerCase() === session.user.name.toLowerCase() ? session.user.id : null),
          }))
          const groupPlayersToInsert = rawPlayers.map((player) => ({
            groupId: id,
            playerId: player.id,
          }))

          await tx.insert(boardPlayers).values(playersToInsert)
          await tx.insert(boardGroupPlayers).values(groupPlayersToInsert)
        }
      })
    }

    if (body.type === 'player') {
      await db.transaction(async (tx) => {
        await tx.insert(boardPlayers).values({
          ...body.player,
          userId: body.player.userId || null,
        })
        await tx.insert(boardGroupPlayers).values({ groupId: body.groupId, playerId: body.player.id })
      })
    }

    if (body.type === 'game') {
      await db.transaction(async (tx) => {
        await tx.insert(boardGames).values(body.game)
        await tx.insert(boardGroupGames).values({ groupId: body.groupId, gameId: id })
      })
    }

    if (body.type === 'match') {
      const playerIds: string[] = body.playerIds ?? []
      const rawPlayedAt = body.match?.playedAt ? new Date(body.match.playedAt) : new Date()
      const playedAt = Number.isNaN(rawPlayedAt.getTime()) ? new Date() : rawPlayedAt

      await db.transaction(async (tx) => {
        await tx.insert(boardMatches).values({
          ...body.match,
          playedAt,
        })
        if (playerIds.length > 0) {
          await tx.insert(boardMatchPlayers).values(
            playerIds.map((playerId) => ({ matchId: id, playerId }))
          )
        }
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API /api/board POST error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Error al guardar en la base de datos' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { type, id } = body
  if (!id || typeof id !== 'string' || !['group', 'game', 'match', 'leave-group'].includes(type)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (type === 'leave-group') {
    const [group] = await db.select().from(boardGroups).where(eq(boardGroups.id, id))
    if (!group) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    }

    const memberLinks = await db
      .select({ playerId: boardGroupPlayers.playerId })
      .from(boardGroupPlayers)
      .where(eq(boardGroupPlayers.groupId, id))

    const isCreator = Boolean(group.createdBy && group.createdBy === session.user.id)

    let matchingPlayers: Array<{ id: string }> = []
    if (memberLinks.length > 0) {
      matchingPlayers = await db
        .select({ id: boardPlayers.id })
        .from(boardPlayers)
        .where(
          and(
            inArray(boardPlayers.id, memberLinks.map((m) => m.playerId)),
            or(
              eq(boardPlayers.userId, session.user.id),
              sql`LOWER(${boardPlayers.name}) = LOWER(${session.user.name})`
            )
          )
        )
    }

    if (matchingPlayers.length === 0 && !isCreator) {
      return NextResponse.json({ error: 'No pertenecés a este grupo' }, { status: 403 })
    }

    await db.transaction(async (tx) => {
      if (matchingPlayers.length > 0) {
        await tx
          .delete(boardGroupPlayers)
          .where(
            and(
              eq(boardGroupPlayers.groupId, id),
              inArray(boardGroupPlayers.playerId, matchingPlayers.map((p) => p.id))
            )
          )
      }

      const remainingLinks = await tx
        .select({ playerId: boardGroupPlayers.playerId })
        .from(boardGroupPlayers)
        .where(eq(boardGroupPlayers.groupId, id))

      if (remainingLinks.length === 0) {
        // Cascades automatically clean up matches, games, and match players
        await tx.delete(boardGroups).where(eq(boardGroups.id, id))
      } else if (isCreator) {
        // Transfer group ownership to the first remaining member with a userId, or clear createdBy
        const remainingPlayers = await tx
          .select({ id: boardPlayers.id, userId: boardPlayers.userId })
          .from(boardPlayers)
          .where(inArray(boardPlayers.id, remainingLinks.map((r) => r.playerId)))

        const nextCreator = remainingPlayers.find((p) => p.userId && p.userId !== session.user.id)
        await tx
          .update(boardGroups)
          .set({ createdBy: nextCreator?.userId || null })
          .where(eq(boardGroups.id, id))
      }
    })

    return NextResponse.json({ ok: true })
  }

  if (type === 'group') {
    const [group] = await db
      .select({ id: boardGroups.id, createdBy: boardGroups.createdBy })
      .from(boardGroups)
      .where(eq(boardGroups.id, id))

    if (!group) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    }

    // Only creator can delete the group
    if (group.createdBy && group.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Solo la persona que creó el grupo puede eliminarlo.' },
        { status: 403 }
      )
    }

    // ON DELETE CASCADE automatically removes group relations, matches, and match players in 1 query
    await db.delete(boardGroups).where(eq(boardGroups.id, id))
  }

  if (type === 'game') {
    // ON DELETE CASCADE automatically removes group_games and associated matches
    await db.delete(boardGames).where(eq(boardGames.id, id))
  }

  if (type === 'match') {
    // ON DELETE CASCADE automatically removes match_players
    await db.delete(boardMatches).where(eq(boardMatches.id, id))
  }

  return NextResponse.json({ ok: true })
}

