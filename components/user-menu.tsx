'use client'

import Image from 'next/image'
import { type Session } from '@supabase/auth-helpers-nextjs'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { toast } from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconSpinner } from '@/components/ui/icons'

export interface UserMenuProps {
  user: Session['user']
}

function getUserInitials(name: string) {
  const [firstName, lastName] = name.split(' ')
  return lastName ? `${firstName[0]}${lastName[0]}` : firstName.slice(0, 2)
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  // 密码修改状态
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isChangingPassword, setIsChangingPassword] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')

  // 用户资料状态
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false)
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)
  const [nickname, setNickname] = React.useState(user?.user_metadata?.name || '')

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('密码长度不能少于6位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    setIsChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('密码修改成功')
        setNewPassword('')
        setConfirmPassword('')
        setDialogOpen(false)
      }
    } catch (err: any) {
      toast.error(err.message || '密码修改失败')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!nickname.trim()) {
      toast.error('昵称不能为空')
      return
    }
    setIsSavingProfile(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: nickname.trim() }
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('昵称修改成功')
        setProfileDialogOpen(false)
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message || '昵称修改失败')
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="pl-0">
            {user?.user_metadata.avatar_url ? (
              <Image
                height={60}
                width={60}
                className="h-6 w-6 select-none rounded-full ring-1 ring-zinc-100/10 transition-opacity duration-300 hover:opacity-80"
                src={
                  user?.user_metadata.avatar_url
                    ? `${user.user_metadata.avatar_url}&s=60`
                    : ''
                }
                alt={user.user_metadata.name ?? 'Avatar'}
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-muted/50 text-xs font-medium uppercase text-muted-foreground">
                {getUserInitials(user?.user_metadata.name ?? user?.email)}
              </div>
            )}
            <span className="ml-2">{user?.user_metadata.name ?? '👋🏼'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8} align="start" className="w-[180px]">
          <DropdownMenuItem className="flex-col items-start">
            <div className="text-xs font-medium">
              {user?.user_metadata.name}
            </div>
            <div className="text-xs text-zinc-500">{user?.email}</div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Dialog open={profileDialogOpen} onOpenChange={(open) => { setProfileDialogOpen(open); if (open) setNickname(user?.user_metadata?.name || ''); }}>
            <DialogTrigger asChild>
              <DropdownMenuItem
                className="text-xs"
                onSelect={(e: Event) => e.preventDefault()}
              >
                用户资料
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>用户资料</DialogTitle>
                <DialogDescription>
                  修改您的显示昵称，其他用户将看到此名称。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nickname" className="text-right">
                    昵称
                  </Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="col-span-3"
                    placeholder="输入您的昵称"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile && (
                    <IconSpinner className="mr-2 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem
                className="text-xs"
                onSelect={(e: Event) => e.preventDefault()}
              >
                修改密码
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>修改密码</DialogTitle>
                <DialogDescription>
                  请输入新密码并确认，密码长度不能少于6位。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-password" className="text-right">
                    新密码
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="confirm-password" className="text-right">
                    确认密码
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword && (
                    <IconSpinner className="mr-2 animate-spin" />
                  )}
                  确认修改
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-xs">
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
