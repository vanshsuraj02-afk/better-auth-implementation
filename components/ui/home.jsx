"use client"
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import React from 'react'


function HomeView() {
    const { data: session } = authClient.useSession();
    const router = useRouter();
    if (!session) {
        return <p>Loading....</p>
    }

    return (
        <div className={"flex flex-col items-center justify-center p-4 gap-y-4"}>
            <p className='text-sm font-medium text-muted-foreground'>Hello {session.user.email}</p>
            <Button onClick={() => authClient.signOut({
                callbackURL: "/dashboard",
                fetchOptions: {
                    onSuccess: () => {
                        router.push("/login")
                    },
                },
            })}>
                Logout
            </Button>
        </div>
    )
}

export default HomeView